import { ExecutionContext } from '@nestjs/common'
import { UserPermission } from '@app/types/user.permissions'
import { bitmaskHas } from '@app/utils/bitmask'

const SECOND = 1000
const MINUTE = 60 * SECOND

/*
 * Per-route rate-limit tiers. Each tier overrides the global `default`
 * throttler on the routes it is applied to.
 */
export const ThrottleTier = {
  Default: { ttl: MINUTE, limit: 100 },
  Search: { ttl: 10 * SECOND, limit: 30 },
  Mutation: { ttl: MINUTE, limit: 30 },
  Favorite: { ttl: MINUTE, limit: 120 },
  AdminMutation: { ttl: MINUTE, limit: 20 },
  Import: { ttl: MINUTE, limit: 5 },
  Stream: { ttl: MINUTE, limit: 120 },
  Public: { ttl: MINUTE, limit: 60 },
  // Upload is the most expensive endpoint (image processing + S3, up to 10
  // files per request). Admins are exempt entirely via UserThrottlerGuard.
  Upload: { ttl: MINUTE, limit: 10 },
} as const

interface RequestWithSession {
  session?: { user?: { permissions?: number } }
}

export const isAdminContext = (context: ExecutionContext): boolean => {
  const request = context.switchToHttp().getRequest<RequestWithSession>()
  const permissions = request.session?.user?.permissions ?? UserPermission.Zero

  return bitmaskHas(permissions, UserPermission.Administrator)
}
