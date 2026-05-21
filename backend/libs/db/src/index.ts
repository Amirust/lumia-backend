import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '@app/db/db.schema'

export * from './db.module'
export * from './db.symbol'

export type DrizzleDB = NodePgDatabase<typeof schema>
