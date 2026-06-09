import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

interface RequestWithSession {
  session?: { user?: { id?: string } }
  ip?: string
}

/*
 * Tracks limits per authenticated user (falling back to IP for anonymous
 * routes), so a shared NAT/proxy does not throttle every user at once.
 * The session is populated by the global AuthGuard, which runs first.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithSession): Promise<string> {
    const userId = req.session?.user?.id

    return Promise.resolve(userId ?? req.ip ?? 'unknown')
  }
}
