import { Controller, Get, Param, Session } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { UsersService } from './users.service'
import { type UserSession } from '@thallesp/nestjs-better-auth'
import { UserPermission } from '@app/types/user.permissions'
import UserResponseDto from './dto/user.response.dto'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id (use @me for the current user)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(UserResponseDto)
  async getUser(
    @Session() session: UserSession,
    @Param('id') id: string
  ) {
    if (id === '@me') id = session.user.id

    const isSelf = id === session.user.id
    const isAdmin = !isSelf && await this.usersService.hasPermission(session.user.id, UserPermission.Administrator)

    return this.usersService.getUser(id, { includePermissions: isSelf || isAdmin })
  }
}
