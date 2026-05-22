import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { user } from '@app/db/db.schema'
import { eq } from 'drizzle-orm'
import { UserPermission } from '@app/types/user.permissions'
import { bitmaskHas } from '@app/utils/bitmask'
import { ErrorCode } from '@app/types/error-code.enum'

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
  ) {}

  async getUser(id: string) {
    const [ data ] = await this.db
      .select({
        name: user.name,
        imageUrl: user.image,
      })
      .from(user)
      .where(eq(user.id, id))

    return data
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
