import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { DrizzleTx, imageTagIndexTable, tagsTable, tagsToImagesTable } from '@app/db/db.schema'
import { and, eq, inArray, sql } from 'drizzle-orm'

@Injectable()
export class TagsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
  ) {}

  async resolveTagsIds(tags: string[]) {
    return this.db
      .select({
        id: tagsTable.id,
      })
      .from(tagsTable)
      .where(inArray(tagsTable.name, tags))
  }

  async addTags(id: string, toAdd: string[]) {
    const ids = await this.resolveTagsIds(toAdd)

    if (!ids.length) return undefined

    const [ updated ] = await this.db.transaction(async (tx) => {
      const inserts = await tx
        .insert(tagsToImagesTable)
        .values(
          ids.map(({ id: tagId }) => ({
            tagId,
            imageId: id,
          })),
        )
        .onConflictDoNothing()
        .returning()

      await this.reassemblyTags(tx, id)

      return inserts
    })

    return updated
  }

  async removeTags(id: string, toRemove: string[]) {
    const ids = await this.resolveTagsIds(toRemove)

    if (!ids.length) return undefined

    const [ updated ] = await this.db.transaction(async (tx) => {
      const inserts = await tx
        .delete(tagsToImagesTable)
        .where(
          and(
            eq(tagsToImagesTable.imageId, id),
            inArray(
              tagsToImagesTable.tagId,
              ids.map(({ id }) => id),
            ),
          ),
        )
        .returning()

      await this.reassemblyTags(tx, id)

      return inserts
    })

    return updated
  }

  private async reassemblyTags(tx: DrizzleTx, imageId: string) {
    return tx.insert(imageTagIndexTable)
      .values({
        imageId,
        tagIds: sql<number[]>`
          COALESCE(
            (
              SELECT ARRAY_AGG(${tagsToImagesTable.tagId} ORDER BY ${tagsToImagesTable.tagId})
              FROM ${tagsToImagesTable}
              WHERE ${tagsToImagesTable.imageId} = ${imageId}
            ),
            ARRAY[]::integer[]
          )
        `,
      })
      .onConflictDoUpdate({
        target: imageTagIndexTable.imageId,
        set: {
          tagIds: sql`excluded.tag_ids`,
        },
      })
  }
}
