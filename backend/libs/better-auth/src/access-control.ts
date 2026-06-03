const ENABLED_VALUE = 'true'

export interface AccessControlConfig {
  whitelistEnabled: boolean
  whitelist: ReadonlySet<string>
  blacklistEnabled: boolean
  blacklist: ReadonlySet<string>
}

export interface AccessDecision {
  allowed: boolean
  reason?: string
}

const parseIdList = (raw: string | undefined): Set<string> => {
  if (!raw) return new Set()

  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
}

export const createAccessControlConfig = (env: {
  APP_WHITELIST_ON?: string
  APP_WHITELIST?: string
  APP_BLACKLIST_ON?: string
  APP_BLACKLIST?: string
}): AccessControlConfig => ({
  whitelistEnabled: env.APP_WHITELIST_ON === ENABLED_VALUE,
  whitelist: parseIdList(env.APP_WHITELIST),
  blacklistEnabled: env.APP_BLACKLIST_ON === ENABLED_VALUE,
  blacklist: parseIdList(env.APP_BLACKLIST),
})

export const isAccessControlEnabled = (config: AccessControlConfig): boolean => {
  return config.whitelistEnabled || config.blacklistEnabled
}

export const checkDiscordAccess = (
  discordId: string,
  config: AccessControlConfig,
): AccessDecision => {
  if (config.blacklistEnabled && config.blacklist.has(discordId))
    return { allowed: false, reason: 'This Discord account is blacklisted.' }

  if (config.whitelistEnabled && !config.whitelist.has(discordId))
    return { allowed: false, reason: 'This Discord account is not whitelisted.' }

  return { allowed: true }
}

export const checkAccessWithoutDiscordId = (
  config: AccessControlConfig,
): AccessDecision => {
  if (config.whitelistEnabled)
    return { allowed: false, reason: 'A whitelisted Discord account is required.' }

  return { allowed: true }
}
