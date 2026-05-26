import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import {
  episodesTable,
  ImageRecord,
  imagesTable,
  screenshotsTable,
  tagsTable,
  tagsToImagesTable,
} from '@app/db/db.schema'
import { and, eq, exists, getTableColumns, inArray, notExists, sql } from 'drizzle-orm'
import { UsersService } from '../users/users.service'
import { UserPermission } from '@app/types/user.permissions'
import { ErrorCode } from '@app/types/error-code.enum'
import { R2Service } from '@app/r2'
import { snowflake } from '@app/utils/snowflake'
import { sha256 } from '@app/utils/sha256'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import { ImageStatus } from '@app/types/image.status.enum'
import { getStorageKey, getStorageKeyThumbnail } from '@app/utils/get-storage-key'
import { getFileMetaFromBuffer } from '@app/utils/get-file-meta-from-buffer'
import { MlClientService } from '@app/ml-client'
import { LruCache } from '@app/lru-cache'
import { TaskQueueService, TaskType } from '@app/task-queue'
import { JobHandler } from '@app/task-queue/decorators/job.decorator'
import { TagsCategory } from '@app/ml-client/ml-client.types'

interface FindManyOptions {
  tags?: string[];
  excludeTags?: string[];

  authorId?: string;

  seasonId?: string;
  episodeId?: string;
}

interface ImageResponse extends ImageRecord {
  tagsByCategory: {
    [category in TagsCategory]?: string[]
  }
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger('ImagesService')

  private readonly lruCacheImageBuffers = new LruCache()
  private readonly lruCacheImages = new LruCache()

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly usersService: UsersService,
    private readonly r2Service: R2Service,
    private readonly mlService: MlClientService,
    private readonly taskQueue: TaskQueueService,
  ) {}

  async findOne(id: string) {
    const [ data ] = await this.db.select().from(imagesTable).where(eq(imagesTable.id, id))

    return data
  }

  async findMany(limit: number = 50, lastSeenId?: string, options: FindManyOptions = {}) {
    const result = await this.findManyDeep(limit, lastSeenId, options)

    if (!result.ids.length)
      return {
        images: [],
        afterFilter: result.afterFilter,
      }

    return {
      images: await this.resolveImages(result.ids),
      afterFilter: result.afterFilter,
    }
  }

  async uploadFiles(files: ArrayBuffer[], authorId: string, source: ImageSourceType) {
    const hashes = await Promise.all(files.map((buffer) => sha256(buffer)))

    const duplicates = await this.db
      .select({
        id: imagesTable.id,
        hash: imagesTable.contentHash,
      })
      .from(imagesTable)
      .where(inArray(imagesTable.contentHash, hashes))

    const filesWithMeta = files
      .map((file, index) => ({ file, hash: hashes[index] }))
      .filter(({ hash }) => !duplicates.some((d) => d.hash === hash))
      .map(({ file, hash }) => ({
        meta: {
          id: snowflake(),
          authorId,
          storageKey: getStorageKey(hash, authorId),

          ...getFileMetaFromBuffer(file, hash, source),
        },
        buffer: file,
      }))

    /*
     * Uploading and inserting in DB
     */
    const uploaded = await Promise.all(
      filesWithMeta.map(async (file) => {
        const inserted = await this.db
          .insert(imagesTable)
          .values({
            ...file.meta,
            status: ImageStatus.Uploading,
          })
          .onConflictDoNothing()
          .returning()

        if (!inserted.length) {
          this.logger.warn(`File with hash ${file.meta.contentHash} already exists, skipping upload`)
          return null
        }

        const buffer = Buffer.from(file.buffer, 0, file.buffer.byteLength)

        await this.r2Service.upload(file.meta.storageKey, buffer, file.meta.mime)

        await this.db
          .update(imagesTable)
          .set({
            status: ImageStatus.Pending,
          })
          .where(eq(imagesTable.id, file.meta.id))

        this.lruCacheImageBuffers.set(file.meta.id, buffer)

        return inserted[0]
      }),
    )

    // todo: sse streaming to send new tags after ai to frontend

    for (const image of uploaded.filter((i) => !!i)) {
      await this.taskQueue.send(TaskType.GetTags, { imageId: image.id }, { singletonKey: `get-tags-${image.id}` })
      await this.taskQueue.send(TaskType.GetWebpThumbnail, { imageId: image.id }, { singletonKey: `get-webp-${image.id}` })
    }
  }

  async addTags(id: string, toAdd: string[]) {
    const ids = await this.resolveTagsIds(toAdd)

    const [ updated ] = await this.db
      .insert(tagsToImagesTable)
      .values(
        ids.map(({ id: tagId }) => ({
          tagId,
          imageId: id,
        })),
      )
      .onConflictDoNothing()
      .returning()

    return updated
  }

  async removeTags(id: string, toRemove: string[]) {
    const ids = await this.resolveTagsIds(toRemove)

    const [ updated ] = await this.db
      .delete(tagsToImagesTable)
      .where(
        and(
          eq(tagsToImagesTable.imageId, id),
          inArray(tagsToImagesTable.tagId, ids.map(({ id }) => id)),
        ),
      )
      .returning()

    return updated
  }

  async getTotalCount() {
    const count = this.db.execute(
      sql<{ estimate: number }>`SELECT reltuples::bigint AS estimate
          FROM pg_class
          WHERE relname = ${imagesTable._.name}`,
    )

    return count[0].estimate as number
  }

  /*
   * Permissions helpers
   */

  async ensureUserCan(id: string, userId: string, permission: UserPermission) {
    const image = await this.findOne(id)

    if (!image || !(image.authorId === userId) || !(await this.usersService.hasPermission(userId, permission)))
      throw new ForbiddenException({
        code: ErrorCode.NotEnoughPermissions,
      })
  }

  /*
   * Internal methods
   */

  private async resolveTagsIds(tags: string[]) {
    return this.db
      .select({
        id: tagsTable.id,
      })
      .from(tagsTable)
      .where(inArray(tagsTable.name, tags))
  }

  private async findManyDeep(limit: number = 50, lastSeenId?: string, options: FindManyOptions = {}) {
    const tagsIds: number[] = []
    const excludeTagsIds: number[] = []

    if (options.tags?.length || options.excludeTags?.length) {
      const resolvedTags = options.tags ? await this.resolveTagsIds(options.tags) : []
      const resolvedExcludeTags = options.excludeTags ? await this.resolveTagsIds(options.excludeTags) : []

      // If some tags were not found, it means no images can be found, so we can return early
      if ((options.tags?.length ?? 0) > resolvedTags.length)
        return { ids: [], afterFilter: 0 }

      tagsIds.push(...resolvedTags.map(({ id }) => id))
      excludeTagsIds.push(...resolvedExcludeTags.map(({ id }) => id))
    }

    const result = await this.db
      .select({
        id: imagesTable.id,
        ...(lastSeenId
          ? {}
          : {
            afterFilter: sql<number>`count(*) over ()`.mapWith(Number),
          }),
      })
      .from(imagesTable)
      .where(
        and(
          // Pagination
          lastSeenId ? sql`${imagesTable.id}::bigint > ${lastSeenId}::bigint` : undefined,

          // tags here
          options.tags?.length
            ? exists(
              this.db
                .select({ x: sql`1` })
                .from(tagsToImagesTable)
                .where(
                  and(
                    eq(tagsToImagesTable.imageId, imagesTable.id),
                    inArray(tagsToImagesTable.tagId, tagsIds),
                  ),
                ),
            )
            : undefined,

          options.excludeTags?.length
            ? notExists(
              this.db
                .select({ x: sql`1` })
                .from(tagsToImagesTable)
                .where(
                  and(
                    eq(tagsToImagesTable.imageId, imagesTable.id),
                    inArray(tagsToImagesTable.tagId, excludeTagsIds),
                  ),
                ),
            )
            : undefined,

          // Other meta-stuff

          options.authorId ? eq(imagesTable.authorId, options.authorId) : undefined,

          options.episodeId
            ? exists(
              this.db
                .select({ x: sql`1` })
                .from(screenshotsTable)
                .where(
                  and(
                    eq(screenshotsTable.imageId, imagesTable.id),
                    eq(screenshotsTable.episodeId, options.episodeId),
                  ),
                ),
            )
            : undefined,

          options.seasonId
            ? exists(
              this.db
                .select({ x: sql`1` })
                .from(screenshotsTable)
                .innerJoin(episodesTable, eq(episodesTable.id, screenshotsTable.episodeId))
                .where(
                  and(eq(screenshotsTable.imageId, imagesTable.id), eq(episodesTable.seasonId, options.seasonId)),
                ),
            )
            : undefined,
        ),
      )
      .orderBy(sql`${imagesTable.id}::bigint`)
      .limit(limit)

    const afterFilter = result.length && 'afterFilter' in result[0] ?
      result[0].afterFilter :
      undefined

    return {
      ids: result.map((r) => r.id),
      afterFilter,
    }
  }

  private async resolveImages(imagesIds: string[]) {
    const missingIds = imagesIds.filter((id) => !this.lruCacheImages.has(id))
    let addImages: ImageResponse[] = []

    if (missingIds.length) {
      addImages = await this.db
        .select({
          ...getTableColumns(imagesTable),
          tagsByCategory: sql<Record<string, string[]>>`
            COALESCE((
              SELECT jsonb_object_agg(category, tag_names)
              FROM (
                SELECT t.category, jsonb_agg(t.name ORDER BY t.name) AS tag_names
                FROM ${tagsToImagesTable} ti
                JOIN ${tagsTable} t ON t.id = ti.tag_id
                WHERE ti.image_id = ${imagesTable.id}
                GROUP BY t.category
              ) s
            ), '{}'::jsonb)
          `.mapWith((v) => v as Record<TagsCategory, string[]>),
        })
        .from(imagesTable)
        .where(inArray(imagesTable.id, missingIds))
    }

    const inCache = imagesIds
      .filter((id) => !missingIds.includes(id))
      .map((id) => this.lruCacheImages.get<ImageResponse>(id)!)

    for (const image of addImages)
      this.lruCacheImages.set(image.id, image)

    return [ ...inCache, ...addImages ]
  }

  /*
   * BACKGROUND JOBS
   */

  @JobHandler(TaskType.GetTags)
  private async handleGetTags({ imageId }: { imageId: string }) {
    const image = await this.findOne(imageId)

    if (!image)
      return

    const buffer = this.lruCacheImageBuffers.get<Buffer>(imageId) ?? await this.r2Service.download(image.storageKey!)

    if (!buffer)
      return

    const tags = await this.mlService.getTags(buffer)
    const tagsArray = Object.entries(tags)
      .map((value) => value[1])
      .flat()

    await this.addTags(imageId, tagsArray)

    await this.db
      .update(imagesTable)
      .set({
        status: ImageStatus.Done,
      })
      .where(eq(imagesTable.id, imageId))
  }

  @JobHandler(TaskType.GetWebpThumbnail)
  private async handleGetWebpThumbnail({ imageId }: { imageId: string }) {
    const image = await this.findOne(imageId)

    if (!image)
      return

    const buffer = this.lruCacheImageBuffers.get<Buffer>(imageId) ?? await this.r2Service.download(image.storageKey!)

    if (!buffer)
      return

    const webpBuffer = await this.mlService.getWebpThumbnail(buffer)
    const webpNormalBuffer = Buffer.from(webpBuffer, 0, webpBuffer.byteLength)

    await this.r2Service.upload(getStorageKeyThumbnail(image.contentHash, image.authorId), webpNormalBuffer, 'image/webp')

    await this.db
      .update(imagesTable)
      .set({
        status: ImageStatus.Done,
      })
      .where(eq(imagesTable.id, imageId))
  }
}
