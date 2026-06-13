import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { account, imagesTable, user } from '@app/db/db.schema'
import { and, desc, eq, or, sql } from 'drizzle-orm'
import { UserPermission } from '@app/types/user.permissions'
import { bitmaskHas } from '@app/utils/bitmask'
import { unsafeOrValue } from '@app/utils/unsafe'

interface GetAllUsersOptions {
  searchString?: string
  lastSeenId?: string
}

@Injectable()
export class UsersService {
  private readonly permissionsCache: Map<string, UserPermission> = new Map()

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
  ) {}

  async getUser(id: string, options: { includePermissions?: boolean } = {}) {
    const [ data ] = await this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.image,
        permissions: user.permissions,
        imagesCount: sql`COUNT(${imagesTable.id})`,
      })
      .from(user)
      .leftJoin(imagesTable, eq(imagesTable.authorId, user.id))
      .where(eq(user.id, id))
      .groupBy(user.id)

    if (!data) return data

    if (!options.includePermissions) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { permissions, ...rest } = data
      return rest
    }

    return data
  }

  async getAllUsers(requestedFrom: string, options: GetAllUsersOptions, limit = 20) {
    await this.hasPermission(requestedFrom, UserPermission.Administrator)

    const searchStringIsBigint = unsafeOrValue<boolean>(() => options.searchString ? !!BigInt(options.searchString) : false, false)

    return this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.image,
        permissions: user.permissions,
        imagesCount: sql`COUNT(${imagesTable.id})`,
      })
      .from(user)
      .where(and(
        options.searchString ? or(
          sql`${user.name} ILIKE ${options.searchString + '%'}`,
          sql`${user.username} ILIKE ${options.searchString + '%'}`,
          searchStringIsBigint ?
            eq(account.accountId, options.searchString!) :
            undefined,
        ) : undefined
      ))
      .leftJoin(imagesTable, eq(imagesTable.authorId, user.id))
      .leftJoin(account, eq(account.userId, user.id))
      .groupBy(user.id)
      .having(
        options.lastSeenId
          ? sql`(
              COUNT(${imagesTable.id}) < (SELECT COUNT(*) FROM ${imagesTable} WHERE ${imagesTable.authorId} = ${options.lastSeenId})
              OR (
                COUNT(${imagesTable.id}) = (SELECT COUNT(*) FROM ${imagesTable} WHERE ${imagesTable.authorId} = ${options.lastSeenId})
                AND ${user.id}::bigint > ${options.lastSeenId}::bigint
              )
            )`
          : undefined,
      )
      .orderBy(desc(sql`COUNT(${imagesTable.id})`), sql`${user.id}::bigint ASC`)
      .limit(limit)
  }

  async updatePermissions(requestedFrom: string, userId: string, permissions: UserPermission) {
    await this.hasPermission(requestedFrom, UserPermission.Administrator)

    const [ updated ] = await this.db
      .update(user)
      .set({
        permissions,
      })
      .where(eq(user.id, userId))
      .returning()

    this.permissionsCache.set(userId, permissions)

    return updated
  }

  public async hasPermission(userId: string, permission: UserPermission) {
    let perms = this.permissionsCache.get(userId)

    if (perms === undefined) {
      const [ data ] = await this.db
        .select({
          permissions: user.permissions,
        })
        .from(user)
        .where(eq(user.id, userId))

      perms = data?.permissions || UserPermission.Zero
    }

    return bitmaskHas(perms, permission) || bitmaskHas(perms, UserPermission.Administrator)
  }
}
