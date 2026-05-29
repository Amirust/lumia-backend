import { Body, Controller, Get, Param, Patch, Query, Session } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { UsersService } from './users.service'
import { type UserSession } from '@thallesp/nestjs-better-auth'
import { UserPermission } from '@app/types/user.permissions'
import UserResponseDto from './dto/user.response.dto'
import ListUsersDto from './dto/list-users.dto'
import UpdatePermissionsDto from './dto/update-permissions.dto'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin only, substring search, keyset pagination)' })
  @ApiOkResponseWrapped(UserResponseDto, { isArray: true })
  async getAllUsers(
    @Session() session: UserSession,
    @Query() query: ListUsersDto
  ) {
    return this.usersService.getAllUsers(
      session.user.id,
      { searchString: query.search, lastSeenId: query.lastSeenId },
      query.limit
    )
  }

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

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update a user permissions bitmask (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(UserResponseDto)
  async updatePermissions(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto
  ) {
    return this.usersService.updatePermissions(session.user.id, id, dto.permissions)
  }
}