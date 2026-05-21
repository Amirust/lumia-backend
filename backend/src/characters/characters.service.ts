import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { charactersTable, imagesTable } from '@app/db/db.schema'
import { and, eq, sql } from 'drizzle-orm'
import { snowflake } from '@app/utils/snowflake'

interface FindManyOptions {
  name?: string
  lastSeenId?: string
}

@Injectable()
export class CharactersService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
  ) {}

  async findOne(id: string) {
    const [ data ] = await this.db
      .select()
      .from(charactersTable)
      .where(eq(charactersTable.id, id))

    return data
  }

  async findMany(limit: number = 10, options: FindManyOptions) {
    return this.db
      .select()
      .from(charactersTable)
      .where(and(
        options.lastSeenId ?
          sql`${imagesTable.id}::bigint > ${options.lastSeenId}::bigint` :
          undefined,
        options.name ?
          sql`${charactersTable.displayName} % ${options.name}` :
          undefined,
      ))
      .orderBy(sql`similarity(${charactersTable.displayName}, ${options.name}) DESC`)
      .limit(limit)
  }

  async createIfTagNotExists(tag: string, imageId: string) {
    const [ data ] = await this.db
      .insert(charactersTable)
      .values({
        id: snowflake(),
        tagId: tag,
        displayName: tag,
        coverImageId: imageId,
      })
      .onConflictDoNothing()
      .returning()

    return !!data
  }
}
