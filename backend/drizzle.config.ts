import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/db/src/db.schema.ts',
  out: './libs/db/src/migrations/postgresql',
})
