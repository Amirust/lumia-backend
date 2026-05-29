import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { user } from '@app/db/db.schema'
import { and, eq, or, sql } from 'drizzle-orm'
import { UserPermission } from '@app/types/user.permissions'
import { bitmaskHas } from '@app/utils/bitmask'

interface GetAllUsersOptions {
  searchString?: string
  lastSeenId?: string
}

@Injectable()
export class UsersService {
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
      })
      .from(user)
      .where(eq(user.id, id))

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

    return this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.image,
        permissions: user.permissions,
      })
      .from(user)
      .where(and(
        options.lastSeenId ? sql`${user.id}::bigint > ${options.lastSeenId}::bigint` : undefined,
        options.searchString ? or(
          sql`${user.name} ILIKE ${options.searchString + '%'}`,
          sql`${user.username} ILIKE ${options.searchString + '%'}`
        ) : undefined,
      ))
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

    return updated
  }

  public async hasPermission(userId: string, permission: UserPermission) {
    const [ data ] = await this.db
      .select({
        permissions: user.permissions,
      })
      .from(user)
      .where(eq(user.id, userId))

    const permissions = data?.permissions || UserPermission.Zero

    return bitmaskHas(permissions, permission) || bitmaskHas(permissions, UserPermission.Administrator)
  }
}
