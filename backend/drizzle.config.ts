import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'

const envPath = resolve(__dirname, '../', '.env')
if (existsSync(envPath))
  process.loadEnvFile(envPath)

const databaseUrl = process.env.DATABASE
if (!databaseUrl)
  throw new Error('DATABASE env variable is not set (expected in backend/.env)')

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/db/src/db.schema.ts',
  out: './libs/db/src/migrations/postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: databaseUrl,
  },
})
