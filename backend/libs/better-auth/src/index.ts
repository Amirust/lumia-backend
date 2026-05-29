import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { passkey } from '@better-auth/passkey'

export const getBasicConfig = () => ({
  emailAndPassword: {
    enabled: false,
  },

  plugins: [ passkey() ],

  // Schema changes
  user: {
    additionalFields: {
      permissions: {
        type: 'number' as any,
        required: true,
        default: 0
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
