import { Controller, Get, Param, Session } from '@nestjs/common'
import { UsersService } from './users.service'
import { type UserSession } from '@thallesp/nestjs-better-auth'

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
  ) {}

  @Get(':id')
  async getUser(
    @Session() session: UserSession,
    @Param('id') id: string
  ) {
    if (id === '@me') id = session.user.id

    return this.usersService.getUser(id)
  }
}
