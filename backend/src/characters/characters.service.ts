import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { charactersTable, imagesTable, tagsTable } from '@app/db/db.schema'
import { and, eq, getTableColumns, sql } from 'drizzle-orm'
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
      .select({
        ...getTableColumns(charactersTable),
        tag: tagsTable.name
      })
      .from(charactersTable)
      .where(eq(charactersTable.id, id))
      .leftJoin(tagsTable, eq(tagsTable.id, charactersTable.tagId))

    return data
  }

  async findMany(limit: number = 10, options: FindManyOptions) {
    return this.db
      .select({
        ...getTableColumns(charactersTable),
        tag: tagsTable.name
      })
      .from(charactersTable)
      .where(and(
        options.lastSeenId ?
          sql`${imagesTable.id}::bigint > ${options.lastSeenId}::bigint` :
          undefined,
        options.name ?
          sql`${charactersTable.displayName} % ${options.name}` :
          undefined,
      ))
      .orderBy(sql`similarity(${charactersTable.displayName}, ${options.name ?? ''}) DESC`)
      .leftJoin(tagsTable, eq(tagsTable.id, charactersTable.tagId))
      .limit(limit)
  }

  async createIfTagNotExists(tagId: number, imageId?: string, name?: string) {
    const [ data ] = await this.db
      .insert(charactersTable)
      .values({
        id: snowflake(),
        tagId,
        displayName: name ?? `Character ${tagId}`,
        coverImageId: imageId,
      })
      .onConflictDoNothing()
      .returning()

    return !!data
  }

  async createIfTagNotExistsBulk(characters: { tagId: number, imageId: string }[]) {
    const createdCharacters = await this.db
      .insert(charactersTable)
      .values(
        characters.map(c => ({
          id: snowflake(),
          tagId: c.tagId,
          displayName: `Character ${c.tagId}`,
          coverImageId: c.imageId,
        }))
      )
      .onConflictDoNothing()
      .returning()

    return createdCharacters.length
  }
}
