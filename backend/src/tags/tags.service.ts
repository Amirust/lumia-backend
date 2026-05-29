import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { DrizzleTx, imageTagIndexTable, tagsTable, tagsToImagesTable } from '@app/db/db.schema'
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'

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
      await this.recountTags(tx, inserts.map((i) => i.tagId))

      return inserts
    })

    return updated
  }

  async autocomplete(options: { q?: string; category?: string; limit?: number } = {}) {
    return this.db
      .select({
        name: tagsTable.name,
        category: tagsTable.category,
        usageCount: tagsTable.usageCount,
        colorOverride: tagsTable.colorOverride,
      })
      .from(tagsTable)
      .where(and(
        options.q ?
          sql`${tagsTable.name} ILIKE ${options.q + '%'}` :
          undefined,

        options.category ?
          eq(tagsTable.category, options.category) :
          undefined,
      ))
      .orderBy(sql`${tagsTable.usageCount} DESC`)
      .limit(options.limit ?? 10)
  }

  async list(options: { search?: string; category?: string; limit?: number; lastSeenId?: number } = {}) {
    return this.db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        category: tagsTable.category,
        usageCount: tagsTable.usageCount,
        colorOverride: tagsTable.colorOverride,
      })
      .from(tagsTable)
      .where(and(

        options.lastSeenId ?
          gt(tagsTable.id, options.lastSeenId) :
          undefined,

        options.search ?
          sql`${tagsTable.name} ILIKE ${'%' + options.search + '%'}` :
          undefined,

        options.category ?
          eq(tagsTable.category, options.category) :
          undefined,
      ))
      .orderBy(asc(tagsTable.id))
      .limit(options.limit ?? 50)
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
      await this.recountTags(tx, inserts.map((i) => i.tagId))

      return inserts
    })

    return updated
  }

  async recountTags(tx: DrizzleTx, tagIds: number[]) {
    if (!tagIds.length) return

    await tx
      .update(tagsTable)
      .set({
        usageCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${tagsToImagesTable}
          WHERE ${tagsToImagesTable.tagId} = ${tagsTable.id}
        )`,
      })
      .where(inArray(tagsTable.id, tagIds))
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
