import { APIError } from 'better-auth/api'
import { and, eq } from 'drizzle-orm'
import { account } from '@app/db/db.schema'
import { DrizzleDB } from '@app/db'
import {
  AccessControlConfig,
  AccessDecision,
  checkAccessWithoutDiscordId,
  checkDiscordAccess,
  isAccessControlEnabled,
} from '@app/better-auth/access-control'

const DISCORD_PROVIDER_ID = 'discord'
const ACCESS_DENIED_CODE = 'ACCESS_DENIED'

const denyAccess = (decision: AccessDecision): never => {
  throw new APIError('FORBIDDEN', {
    code: ACCESS_DENIED_CODE,
    message: decision.reason ?? 'Access denied.',
  })
}

// Resolve the Discord account id linked to a user, if any.
const findDiscordId = async (
  db: DrizzleDB,
  userId: string,
): Promise<string | null> => {
  const [ row ] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, DISCORD_PROVIDER_ID)),
    )
    .limit(1)

  return row?.accountId ?? null
}

interface AuthAccessHooksDeps {
  db: DrizzleDB
  config: AccessControlConfig
}

// Builds better-auth `databaseHooks` that gate sign-in by Discord ID.
//
// - account.create.before: rejects brand-new Discord sign-ups before any
//   account row is linked (the Discord id is available directly here).
// - session.create.before: runs on every login (Discord, passkey, email), so
//   users blacklisted/de-whitelisted after sign-up are blocked too. The Discord
//   id is not in the session payload, so it is resolved from the account table.
export const createAuthAccessHooks = ({ db, config }: AuthAccessHooksDeps) => {
  if (!isAccessControlEnabled(config)) return undefined

  return {
    account: {
      create: {
        before: async (acc: { providerId: string; accountId: string }) => {
          if (acc.providerId !== DISCORD_PROVIDER_ID) return

          const decision = checkDiscordAccess(acc.accountId, config)
          if (!decision.allowed) denyAccess(decision)
        },
      },
    },
    session: {
      create: {
        before: async (session: { userId: string }) => {
          const discordId = await findDiscordId(db, session.userId)

          const decision = discordId
            ? checkDiscordAccess(discordId, config)
            : checkAccessWithoutDiscordId(config)

          if (!decision.allowed) denyAccess(decision)
        },
      },
    },
  }
}
