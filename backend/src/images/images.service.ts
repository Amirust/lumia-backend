import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { episodesTable, imagesTable, screenshotsTable } from '@app/db/db.schema'
import { and, arrayOverlaps, count, desc, eq, exists, getTableColumns, sql } from 'drizzle-orm'

interface FindManyOptions {
  tags?: string[]
  excludeTags?: string[]

  authorId?: string

  seasonId?: string
  episodeId?: string
}

@Injectable()
export class ImagesService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
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

