import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { episodesTable, imagesTable, screenshotsTable } from '@app/db/db.schema'
import { and, arrayOverlaps, count, desc, eq, exists, getTableColumns, inArray, sql } from 'drizzle-orm'
import { UsersService } from '../users/users.service'
import { UserPermission } from '@app/types/user.permissions'
import { ErrorCode } from '@app/types/error-code.enum'
import { R2Service } from '@app/r2'
import { snowflake } from '@app/utils/snowflake'
import { sha256 } from '@app/utils/sha256'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import { ImageStatus } from '@app/types/image.status.enum'
import { getStorageKey } from '@app/utils/get-storage-key'
import { getFileMetaFromBuffer } from '@app/utils/get-file-meta-from-buffer'
import { MlClientService } from '@app/ml-client'

interface FindManyOptions {
  tags?: string[]
  excludeTags?: string[]

  authorId?: string

  seasonId?: string
  episodeId?: string
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger('ImagesService')

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly usersService: UsersService,
    private readonly r2Service: R2Service,
    private readonly mlService: MlClientService
  ) {}

  async findOne(id: string) {
    const [ data ] = await this.db
      .select()
      .from(imagesTable)
      .where(eq(imagesTable.id, id))

    return data
  }

  async findMany(limit: number = 50, lastSeenId?: string, options: FindManyOptions = {}) {
    return this.findManyDeep(limit, lastSeenId, options)
  }

  async uploadFiles(files: ArrayBuffer[], authorId: string, source: ImageSourceType) {
    const hashes = await Promise.all(files.map(buffer => sha256(buffer)))

    const duplicates = await this.db
      .select({
        id: imagesTable.id,
        hash: imagesTable.contentHash,
      })
      .from(imagesTable)
      .where(inArray(imagesTable.contentHash, hashes))

    const filesWithMeta = files
      .map((file, index) => ({ file, hash: hashes[index] }))
      .filter(({ hash }) => !duplicates.some(d => d.hash === hash))
      .map(({ file, hash }) => ({
        meta: {
          id: snowflake(),
          authorId,
          storageKey: getStorageKey(hash, authorId),

          ...getFileMetaFromBuffer(file, hash, source),
        },
        buffer: file,
      }))

    // Todo process images to gen tags and thumbnails
    const tags = await this.mlService.getTags(files[0])

    /*
     * Uploading and inserting in DB
     */
    return await Promise.all(filesWithMeta.map(async (file) => {
      const inserted = await this.db
        .insert(imagesTable)
        .values({
          ...file.meta,
          status: ImageStatus.Pending,
        })
        .onConflictDoNothing()
        .returning()

      if (!inserted.length) {
        this.logger.warn(`File with hash ${file.meta.contentHash} already exists, skipping upload`)
        return null
      }

      await this.r2Service.upload(
        file.meta.storageKey,
        Buffer.from(file.buffer, 0, file.buffer.byteLength),
        file.meta.mime
      )

      // todo: sse streaming to send new tags after ai to frontend
      return inserted[0]
    }))
  }

  async addTags(id: string, toAdd: string[]) {
    const [ updated ] = await this.db
      .update(imagesTable)
      .set({
        tags: sql`ARRAY(SELECT DISTINCT unnest(tags || ${toAdd}))`,
      })
      .where(eq(imagesTable.id, id))
      .returning()

    return updated
  }

  async removeTags(id: string, toRemove: string[]) {
    const [ updated ] = await this.db
      .update(imagesTable)
      .set({
        tags: sql`ARRAY(SELECT DISTINCT unnest(tags) EXCEPT SELECT unnest(${toRemove}::text[]))`,
      })
      .where(eq(imagesTable.id, id))
      .returning()

    return updated
  }

  async getAllTags() {
    const freq = count()

    return this.db
      .select({
        tag: sql`unnest (${imagesTable.tags})`,
        count: freq,
      })
      .from(imagesTable)
      .groupBy(sql`tags`)
      .orderBy(desc(freq), sql`tag`)
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

    if (
      !image ||
      !(image.authorId === userId) ||
      !await this.usersService.hasPermission(userId, permission)
    ) throw new ForbiddenException({
      code: ErrorCode.NotEnoughPermissions,
    })
  }

  /*
   * Internal methods
   */

  private async findManyDeep(limit: number = 50, lastSeenId?: string, options: FindManyOptions = {}) {
    return this.db
      .select({
        ...getTableColumns(imagesTable),
        ...(lastSeenId ? {} : {
          afterFilter: sql<number>`count(*) over ()`.mapWith(Number),
        }),
      })
      .from(imagesTable)
      .where(and(
        lastSeenId ?
          sql`${imagesTable.id}::bigint > ${lastSeenId}::bigint` :
          undefined,

        options.tags ?
          arrayOverlaps(imagesTable.tags, options.tags) :
          undefined,

        options.excludeTags ?
          sql`NOT (${arrayOverlaps(imagesTable.tags, options.excludeTags)})` :
          undefined,

        options.authorId ?
          eq(imagesTable.authorId, options.authorId) :
          undefined,

        options.episodeId ?
          exists(
            this.db.select({ x: sql`1` }).from(screenshotsTable).where(and(
              eq(screenshotsTable.imageId, imagesTable.id),
              eq(screenshotsTable.episodeId, options.episodeId),
            )),
          ) :
          undefined,

        options.seasonId ?
          exists(
            this.db.select({ x: sql`1` })
              .from(screenshotsTable)
              .innerJoin(episodesTable, eq(episodesTable.id, screenshotsTable.episodeId))
              .where(and(
                eq(screenshotsTable.imageId, imagesTable.id),
                eq(episodesTable.seasonId, options.seasonId),
              )),
          ) :
          undefined,
      ))
      .orderBy(sql`${imagesTable.id}::bigint`)
      .limit(limit)
  }
}

