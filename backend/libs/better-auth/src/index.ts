import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { passkey } from '@better-auth/passkey'

export const getBasicConfig = () => ({
  emailAndPassword: {
    enabled: true,
  },
  plugins: [ passkey() ],

  // Schema changes
  user: {
    additionalFields: {
      permissions: {
        type: 'number' as any,
        required: true,
        default: 0
      }
    }
  },
})

export const auth = betterAuth({
  ...getBasicConfig(),
  database: drizzleAdapter({}, {
    provider: 'pg'
  }),
})
