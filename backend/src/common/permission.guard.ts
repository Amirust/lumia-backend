import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UsersService } from '../users/users.service'
import { UserPermission } from '@app/types/user.permissions'
import { ErrorCode } from '@app/types/error-code.enum'
import { PERMISSION_KEY } from './require-permission.decorator'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserPermission | undefined>(
      PERMISSION_KEY,
      [ context.getHandler(), context.getClass() ],
    )

    if (required === undefined) return true

    const request = context.switchToHttp().getRequest<{ session?: { user?: { id?: string } } }>()
    const userId = request.session?.user?.id

    if (!userId || !(await this.usersService.hasPermission(userId, required)))
      throw new ForbiddenException({ code: ErrorCode.NotEnoughPermissions })

    return true
  }
}
