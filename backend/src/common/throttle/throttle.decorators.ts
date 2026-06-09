import { Throttle } from '@nestjs/throttler'
import {
  ThrottleTier,
  UploadThrottle,
  isAdminContext,
} from './throttle.constants'

export const ThrottleSearch = () => Throttle({ default: ThrottleTier.Search })
export const ThrottleMutation = () => Throttle({ default: ThrottleTier.Mutation })
export const ThrottleFavorite = () => Throttle({ default: ThrottleTier.Favorite })
export const ThrottleAdminMutation = () => Throttle({ default: ThrottleTier.AdminMutation })
export const ThrottleImport = () => Throttle({ default: ThrottleTier.Import })
export const ThrottleStream = () => Throttle({ default: ThrottleTier.Stream })
export const ThrottlePublic = () => Throttle({ default: ThrottleTier.Public })

/*
 * Upload limit is resolved per-request: admins get a higher ceiling.
 * The admin check reads permissions already loaded onto the session by the
 * global AuthGuard, so it costs no extra DB query.
 */
export const ThrottleUpload = () =>
  Throttle({
    default: {
      ttl: UploadThrottle.ttl,
      limit: (context) =>
        isAdminContext(context) ? UploadThrottle.adminLimit : UploadThrottle.userLimit,
    },
  })
