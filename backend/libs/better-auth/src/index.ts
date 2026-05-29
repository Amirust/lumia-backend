import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { passkey } from '@better-auth/passkey'
import { bearer } from 'better-auth/plugins'
import { DefaultUserPermissions } from '@app/types/user.permissions'

export const getBasicConfig = () => ({
  emailAndPassword: {
    enabled: true,
  },

  plugins: [ passkey(), bearer() ],

  // Schema changes
  user: {
    additionalFields: {
      permissions: {
        type: 'number' as any,
        defaultValue: DefaultUserPermissions,
        input: false
      },
      username: {
        type: 'string' as any,
        input: false
      },
    }
  },
})

export const auth = betterAuth({
  ...getBasicConfig(),
  database: drizzleAdapter({}, {
    provider: 'pg'
  }),
})
