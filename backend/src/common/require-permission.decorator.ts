import { SetMetadata } from '@nestjs/common'
import { UserPermission } from '@app/types/user.permissions'

export const PERMISSION_KEY = 'requiredPermission'

export const RequirePermission = (permission: UserPermission) =>
  SetMetadata(PERMISSION_KEY, permission)
