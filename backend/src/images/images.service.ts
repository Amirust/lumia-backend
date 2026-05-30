import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import {
  EpisodeRecord,
  episodesTable,
  imageTagIndexTable,
  ImageRecord,
  imagesTable,
  screenshotsTable,
  SeasonRecord,
  seasonsTable,
  SeriesRecord,
  seriesTable,
  tagsTable,
  tagsToImagesTable,
} from '@app/db/db.schema'
import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  eq,
  exists,
  getTableColumns,
  inArray,
  notInArray,
  sql,
} from 'drizzle-orm'
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
import { EventsService } from '@app/events'
import { EventKey, EventType } from '@app/events/events.types'
import { CharactersService } from '../characters/characters.service'
import { TagsService } from '../tags/tags.service'

interface UploadImageOptions {
  episodeId?: string;

  timestampSeconds?: number;
}

type PreparedUpload = {
  meta: ReturnType<typeof getFileMetaFromBuffer> & {
    id: string
    authorId: string
    storageKey: string
  }
  file: { buffer: ArrayBuffer; options: UploadImageOptions }
}

interface FindManyOptions {
  tags?: string[];
  excludeTags?: string[];

  authorId?: string;

  seriesId?: string;
  seasonId?: string;
  episodeId?: string;

  sourceType?: ImageSourceType;
}

interface TagWithColor {
  tag: string;
  color?: string;
}

export interface ImageResponse extends ImageRecord {
  tagsByCategory: {
    [category in TagsCategory]?: TagWithColor[]
  }

  series?: SeriesRecord | null
  season?: SeasonRecord | null
  episode?: EpisodeRecord | null
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger('ImagesService')

  private readonly lruCacheImageBuffers = new LruCache()
  private readonly lruCacheImages = new LruCache({ maxSize: 10 * 1024 * 1024 }) // 10mb

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly usersService: UsersService,
    private readonly charactersService: CharactersService,
    private readonly r2Service: R2Service,
    private readonly mlService: MlClientService,
    private readonly taskQueue: TaskQueueService,
    private readonly events: EventsService,
    private readonly tagsService: TagsService,
  ) {}

  async findOne(id: string) {
    const data = await this.resolveImages([ id ])

    return data.length ? data[0] : null
  }

  async findMany(limit: number = 50, lastSeenId?: string, options: FindManyOptions = {}) {
    const result = await this.findManyDeep(limit, lastSeenId, options)

    if (!result.ids.length)
      return {
        images: [],
        afterFilter: result.afterFilter,
      }

    return {
      images: (await this.resolveImages(result.ids))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      afterFilter: result.afterFilter,
    }
  }

  async uploadFiles(
    files: { buffer: ArrayBuffer, options: UploadImageOptions }[],
    authorId: string,
    source: ImageSourceType
  ) {
    if (!(await this.usersService.hasPermission(authorId, UserPermission.UploadImages)))
      throw new ForbiddenException({ code: ErrorCode.NotEnoughPermissions })

    const hashes = await Promise.all(files.map((file) => sha256(file.buffer)))

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

          ...getFileMetaFromBuffer(file.buffer, hash, source),
        },
        file: file,
      }))

    /*
     * Uploading and inserting in DB
     */
    const uploaded = await Promise.all(
      filesWithMeta.map((data) => this.uploadSingleFile(data)),
    )

    const created = uploaded.filter((i): i is ImageRecord => !!i)

    for (const image of created) {
      await this.taskQueue.send(
        TaskType.GetTags,
        { imageId: image.id },
        { singletonKey: `get-tags-${image.id}`, retryLimit: 5 }
      )
      await this.taskQueue.send(
        TaskType.GetWebpThumbnail,
        { imageId: image.id },
        { singletonKey: `get-webp-${image.id}`, retryLimit: 5 },
      )
    }

    return created
  }

  async editTags(imageId: string, userId: string, changes: { add?: string[]; remove?: string[] }) {
    const image = await this.findOne(imageId)

    if (!image)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    if (image.authorId !== userId && !(await this.usersService.hasPermission(userId, UserPermission.EditOthersImageTags)))
      throw new ForbiddenException({ code: ErrorCode.NotEnoughPermissions })

    if (changes.add?.length) await this.tagsService.addTags(imageId, changes.add)
    if (changes.remove?.length) await this.tagsService.removeTags(imageId, changes.remove)

    this.lruCacheImages.delete(imageId)

    return this.findOne(imageId)
  }

  async updateImage(imageId: string, userId: string, changes: { episodeId?: string | null; sourceType?: ImageSourceType }) {
    const image = await this.findOne(imageId)

    if (!image)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    if (
      image.authorId !== userId &&
      changes.sourceType === ImageSourceType.Screenshot &&
      !(await this.usersService.hasPermission(userId, UserPermission.AssignOthersEpisodeScreenshots))
    )
      throw new ForbiddenException({ code: ErrorCode.NotEnoughPermissions })

    if (changes.sourceType)
      await this.db
        .update(imagesTable)
        .set({ sourceType: changes.sourceType })
        .where(eq(imagesTable.id, imageId))

    if (changes.episodeId === null)
      await this.db
        .delete(screenshotsTable)
        .where(eq(screenshotsTable.imageId, imageId))

    else if (changes.episodeId)
      await this.db
        .insert(screenshotsTable)
        .values({
          id: snowflake(),
          imageId,
          episodeId: changes.episodeId,
        })
        .onConflictDoNothing()

    this.lruCacheImages.delete(imageId)

    return this.findOne(imageId)
  }

  async getTotalCount() {
    const count = this.db.execute(
      sql<{ estimate: number }>`SELECT reltuples::bigint AS estimate
          FROM pg_class
          WHERE relname = ${imagesTable._.name}`,
    )

    return count[0].estimate as number
  }

  async deleteImage(imageId: string, userId: string) {
    const image = await this.findOne(imageId)

    if (!image)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    if (
      image.authorId !== userId &&
      !(await this.usersService.hasPermission(userId, UserPermission.DeleteOthersImages))
    )
      throw new ForbiddenException({ code: ErrorCode.NotEnoughPermissions })

    await this.db.transaction(async (tx) => {
      const affectedTagIds = (
        await tx
          .select({ tagId: tagsToImagesTable.tagId })
          .from(tagsToImagesTable)
          .where(eq(tagsToImagesTable.imageId, imageId))
      ).map((r) => r.tagId)

      await tx.delete(imagesTable).where(eq(imagesTable.id, imageId))

      await this.tagsService.recountTags(tx, affectedTagIds)
    })

    if (image.storageKey) {
      await this.r2Service
        .delete(image.storageKey)
        .catch((e) => this.logger.error(`Failed to delete image ${imageId} from R2: ${e}`))

      await this.r2Service
        .delete(getStorageKeyThumbnail(image.contentHash, image.authorId))
        .catch((e) => this.logger.error(`Failed to delete thumbnail for ${imageId} from R2: ${e}`))
    }

    this.lruCacheImages.delete(imageId)

    return { ok: true }
  }

  /*
   * Internal methods
   */

  private async uploadSingleFile(data: PreparedUpload): Promise<ImageRecord | null> {
    const buffer = Buffer.from(data.file.buffer, 0, data.file.buffer.byteLength)
    let r2Uploaded = false

    try {
      const image = await this.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(imagesTable)
          .values({
            ...data.meta,
            status: ImageStatus.Pending,
          })
          .onConflictDoNothing()
          .returning()

        if (!inserted.length) {
          this.logger.warn(`File with hash ${data.meta.contentHash} already exists, skipping upload`)
          return null
        }

        await this.r2Service.upload(data.meta.storageKey, buffer, data.meta.mime)
        r2Uploaded = true

        const options = data.file.options
        if (options.episodeId && options.timestampSeconds != null)
          await tx.insert(screenshotsTable).values({
            id: snowflake(),
            imageId: data.meta.id,
            episodeId: options.episodeId,
            timestampSeconds: options.timestampSeconds,
          })

        return inserted[0]
      })

      if (image) this.lruCacheImageBuffers.set(data.meta.id, buffer)

      return image
    } catch (error: unknown) {
      if (r2Uploaded)
        await this.r2Service
          .delete(data.meta.storageKey)
          .catch((e) => this.logger.error(`Failed to clean up R2 object ${data.meta.storageKey}: ${e}`))

      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to upload image ${data.meta.id}: ${message}`)

      return null
    }
  }

  private async findManyDeep(limit: number = 50, lastSeenId?: string, options: FindManyOptions = {}) {
    const tagsIds: number[] = []
    const excludeTagsIds: number[] = []

    if (options.tags?.length || options.excludeTags?.length) {
      const requestedTags = [ ...new Set(options.tags ?? []) ]
      const requestedExcludeTags = [ ...new Set(options.excludeTags ?? []) ]

      const resolvedTags = requestedTags.length ?
        await this.tagsService.resolveTagsIds(requestedTags) :
        []
      const resolvedExcludeTags = requestedExcludeTags.length ?
        await this.tagsService.resolveTagsIds(requestedExcludeTags) :
        []

      // If some tags were not found, it means no images can be found, so we can return early
      if (requestedTags.length > resolvedTags.length) return { ids: [], afterFilter: 0 }

      tagsIds.push(...new Set(resolvedTags.map(({ id }) => id)))
      excludeTagsIds.push(...new Set(resolvedExcludeTags.map(({ id }) => id)))
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
          tagsIds.length
            ? inArray(
              imagesTable.id,
              this.db
                .select({ imageId: imageTagIndexTable.imageId })
                .from(imageTagIndexTable)
                .where(arrayContains(imageTagIndexTable.tagIds, tagsIds)),
            )
            : undefined,

          excludeTagsIds.length
            ? notInArray(
              imagesTable.id,
              this.db
                .select({ imageId: imageTagIndexTable.imageId })
                .from(imageTagIndexTable)
                .where(arrayOverlaps(imageTagIndexTable.tagIds, excludeTagsIds)),
            )
            : undefined,

          // Other meta-stuff

          options.authorId ? eq(imagesTable.authorId, options.authorId) : undefined,

          options.sourceType ? eq(imagesTable.sourceType, options.sourceType) : undefined,

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

          options.seriesId
            ? exists(
              this.db
                .select({ x: sql`1` })
                .from(screenshotsTable)
                .innerJoin(episodesTable, eq(episodesTable.id, screenshotsTable.episodeId))
                .innerJoin(seasonsTable, eq(seasonsTable.id, episodesTable.seasonId))
                .where(
                  and(eq(screenshotsTable.imageId, imagesTable.id), eq(seasonsTable.seriesId, options.seriesId)),
                ),
            )
            : undefined,
        ),
      )
      .orderBy(asc(imagesTable.createdAt))
      .limit(limit)

    const afterFilter = result.length && 'afterFilter' in result[0] ? result[0].afterFilter : undefined

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

          series: seriesTable,
          season: seasonsTable,
          episode: episodesTable,

          tagsByCategory: sql<Record<string, TagWithColor[]>>`
            COALESCE((
              SELECT jsonb_object_agg(category, tags)
              FROM (
                SELECT t.category, jsonb_agg(
                  jsonb_strip_nulls(jsonb_build_object('tag', t.name, 'color', t.color_override))
                  ORDER BY t.name
                ) AS tags
                FROM ${tagsToImagesTable} ti
                JOIN ${tagsTable} t ON t.id = ti.tag_id
                WHERE ti.image_id = ${imagesTable.id}
                GROUP BY t.category
              ) s
            ), '{}'::jsonb)
          `.mapWith((v) => v as Record<TagsCategory, TagWithColor[]>),
        })
        .from(imagesTable)
        .where(inArray(imagesTable.id, missingIds))
        .leftJoin(screenshotsTable, and(
          eq(imagesTable.sourceType, ImageSourceType.Screenshot),
          eq(screenshotsTable.imageId, imagesTable.id),
        ))
        .leftJoin(episodesTable, eq(episodesTable.id, screenshotsTable.episodeId))
        .leftJoin(seasonsTable, eq(seasonsTable.id, episodesTable.seasonId))
        .leftJoin(seriesTable, eq(seriesTable.id, seasonsTable.seriesId))
    }

    const inCache = imagesIds
      .filter((id) => !missingIds.includes(id))
      .map((id) => this.lruCacheImages.get<ImageResponse>(id)!)

    for (const image of addImages) this.lruCacheImages.set(image.id, image)

    return [ ...inCache, ...addImages ]
  }

  /*
   * BACKGROUND JOBS
   */

  @JobHandler(TaskType.GetTags)
  private async handleGetTags({ data: { imageId } }: { data: { imageId: string } }) {
    const image = await this.findOne(imageId)

    if (!image) return

    const buffer = this.lruCacheImageBuffers.get<Buffer>(imageId) ?? (await this.r2Service.download(image.storageKey!))

    if (!buffer) return

    const tags = await this.mlService.getTags(buffer)
    const tagsArray = Object.entries(tags)
      .map((value) => value[1])
      .flat()

    if (tagsArray.length)
      await this.tagsService.addTags(imageId, tagsArray)
    else
      this.logger.warn('ML service returned no tags for image ' + imageId, tags)

    await this.db
      .update(imagesTable)
      .set({
        status: ImageStatus.Done,
      })
      .where(eq(imagesTable.id, imageId))

    if (tags.character?.length) {
      const tagsToResolve = new Set([ ...tags.character ])

      const resolvedIds = await this.tagsService.resolveTagsIds([ ...tagsToResolve.values() ])

      await this.charactersService.createIfTagNotExistsBulk(
        resolvedIds.map(({ id }) => ({
          tagId: id,
          imageId,
        })),
      )
    }

    this.events.emit(EventKey.AiTagsResolved(imageId), {
      type: EventType.AiTagsResolved,
      data: {
        imageId,
        tags
      }
    })
  }

  @JobHandler(TaskType.GetWebpThumbnail)
  private async handleGetWebpThumbnail({ data: { imageId } }: { data: { imageId: string } }) {
    const image = await this.findOne(imageId)

    if (!image) return

    const buffer = this.lruCacheImageBuffers.get<Buffer>(imageId) ?? (await this.r2Service.download(image.storageKey!))

    if (!buffer) return

    const webpBuffer = await this.mlService.getWebpThumbnail(buffer)
    const webpNormalBuffer = Buffer.from(webpBuffer, 0, webpBuffer.byteLength)

    await this.r2Service.upload(
      getStorageKeyThumbnail(image.contentHash, image.authorId),
      webpNormalBuffer,
      'image/webp',
    )

    await this.db
      .update(imagesTable)
      .set({
        status: ImageStatus.Done,
      })
      .where(eq(imagesTable.id, imageId))
  }
}
