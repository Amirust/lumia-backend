import { Inject, Injectable } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { user } from '@app/db/db.schema'
import { eq } from 'drizzle-orm'

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
}
