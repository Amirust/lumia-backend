import { ExecutionContext, Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { isAdminContext } from './throttle.constants'

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

  /*
   * Administrators are exempt from every rate limit.
   */
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(isAdminContext(context))
  }
}
