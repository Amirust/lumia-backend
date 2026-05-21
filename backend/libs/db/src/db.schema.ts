import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { getTableColumns, relations } from 'drizzle-orm'
import { user } from '@app/better-auth/auth.schema'

export * from '@app/better-auth/auth.schema'

/* --- ENUMS --- */

/* --- TABLES --- */
