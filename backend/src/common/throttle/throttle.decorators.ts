import { Throttle } from '@nestjs/throttler'
import { ThrottleTier } from './throttle.constants'

export const ThrottleSearch = () => Throttle({ default: ThrottleTier.Search })
export const ThrottleMutation = () => Throttle({ default: ThrottleTier.Mutation })
export const ThrottleFavorite = () => Throttle({ default: ThrottleTier.Favorite })
export const ThrottleAdminMutation = () => Throttle({ default: ThrottleTier.AdminMutation })
export const ThrottleImport = () => Throttle({ default: ThrottleTier.Import })
export const ThrottleStream = () => Throttle({ default: ThrottleTier.Stream })
export const ThrottlePublic = () => Throttle({ default: ThrottleTier.Public })
export const ThrottleUpload = () => Throttle({ default: ThrottleTier.Upload })
