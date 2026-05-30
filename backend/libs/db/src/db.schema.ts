import { date, index, integer, interval, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { user } from '@app/better-auth/auth.schema'
import { sql } from 'drizzle-orm'
import type { DrizzleDB } from '@app/db/index'

export * from '@app/better-auth/auth.schema'

/* --- ENUMS --- */

export const sourceTypeEnum = pgEnum('source_type', [ 'fanart', 'screenshot' ])
export const uploadStatusEnum = pgEnum('upload_status', [ 'uploading', 'pending', 'indexing', 'done', 'failed' ])

export const taskStateEnum = pgEnum('task_state', [ 'created', 'active', 'completed', 'cancelled', 'failed', 'retry' ])

export const animeStatusEnum = pgEnum('anime_status', [ 'anons', 'ongoing', 'released' ])

/* --- TABLES --- */

export const imagesTable = pgTable('images', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => user.id),
  contentHash: text('content_hash').notNull(),
  
  storageKey: text('storage_key'),

  // png, jpeg, webp, etc
  sourceFormat: text('source_format'),
  width: integer('width'),
  height: integer('height'),
  // in bytes
  fileSize: integer('file_size'),

  sourceType: sourceTypeEnum('source_type').notNull(),

  status: uploadStatusEnum('upload_status').notNull(),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (t) => [
  index('images_author_id_idx').on(t.authorId),
  index('images_status_idx').on(t.status),
  index('images_source_type_idx').on(t.sourceType),
  unique('images_content_hash_unique').on(t.contentHash),
])

export const charactersTable = pgTable('characters', {
  id: text('id').primaryKey(),

  tagId: integer('tag_id').references(() => tagsTable.id, { onDelete: 'set null' }),

  displayName: text('display_name').notNull(),
  coverImageId: text('image_id').references(() => imagesTable.id, { onDelete: 'set null' }),
}, (t) => [
  unique('characters_tag_id_idx').on(t.tagId),
  index('characters_display_name_trgm_idx')
    .using('gin', sql`${t.displayName} gin_trgm_ops`),
])

export const seriesTable = pgTable('series', {
  id: text('id').primaryKey(),

  titleRus: text('title_rus').notNull(),
  titleEng: text('title_eng'),
  titleJap: text('title_jap'),

  rating: text('rating'),

  coverImageId: text('cover_image_id').references(() => imagesTable.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (t) => [
  index('series_title_rus_idx').on(t.titleRus),
  index('series_title_eng_idx').on(t.titleEng)
])

export const seasonsTable = pgTable('seasons', {
  id: text('id').primaryKey(),
  seriesId: text('series_id').references(() => seriesTable.id, { onDelete: 'cascade' }).notNull(),

  number: integer('number').notNull(),
  title: text('title'),

  shikimoriId: integer('shikimori_id'),

  status: animeStatusEnum('status'),
  episodesCount: integer('episodes_count'),
  episodesAired: integer('episodes_aired'),

  airedOn: date('aired_on'),
  releasedOn: date('released_on'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (t) => [
  index('seasons_series_id_idx').on(t.seriesId),
  unique('seasons_shikimori_id_unique').on(t.shikimoriId),
  index('seasons_shikimori_id_idx').on(t.shikimoriId),
])

export const episodesTable = pgTable('episodes', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').references(() => seasonsTable.id, { onDelete: 'cascade' }).notNull(),

  number: integer('number').notNull(),
  title: text('title'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (t) => [
  index('episodes_season_id_idx').on(t.seasonId),
])

export const screenshotsTable = pgTable('screenshots', {
  id: text('id').primaryKey(),

  episodeId: text('episode_id').references(() => episodesTable.id, { onDelete: 'cascade' }).notNull(),
  imageId: text('image_id').references(() => imagesTable.id, { onDelete: 'cascade' }).notNull(),

  timestampSeconds: integer('timestamp_seconds'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('screenshots_episode_id_idx').on(t.episodeId),
  index('screenshots_image_id_idx').on(t.imageId),
  unique('screenshots_episode_image_unique').on(t.episodeId, t.imageId),
])

export const tagsTable = pgTable('tags', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),

  name: text('name').notNull(),
  category: text('category'),

  colorOverride: text('color_override'),

  usageCount: integer('usage_count').default(0).notNull(),
}, (t) => [
  unique('tags_name_unique').on(t.name),
])

export const tagsToImagesTable = pgTable('tags_to_images', {
  tagId: integer('tag_id')
    .references(() => tagsTable.id, { onDelete: 'restrict' })
    .notNull(),

  imageId: text('image_id')
    .references(() => imagesTable.id, { onDelete: 'cascade' })
    .notNull(),
}, (t) => [
  primaryKey({ columns: [ t.imageId, t.tagId ] }),
  unique('tags_to_images_unique').on(t.tagId, t.imageId),
  index('tags_to_images_tag_id_idx').on(t.tagId),
])

export const imageTagIndexTable = pgTable('image_tag_index', {
  imageId: text('image_id')
    .references(() => imagesTable.id, { onDelete: 'cascade' })
    .primaryKey(),

  tagIds: integer('tag_ids').array().notNull(),
}, (t) => [
  index('image_tag_index_tag_ids_idx').using('gin', t.tagIds),
])

export const taskQueueTable = pgTable('task_queue', {
  id: text('id').primaryKey(),

  name: text('name').notNull(),
  data: jsonb('data').notNull(),

  state: taskStateEnum('state').notNull(),

  retryLimit: integer('retry_limit').default(0).notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  // in milliseconds
  retryDelay: integer('retry_delay').default(0).notNull(),

  startAfter: timestamp('start_after').defaultNow().notNull(),
  startedOn: timestamp('started_on'),

  singletonKey: text('singleton_key'),

  expireIn: interval('expire_in').notNull().default('15 minutes'),

  completedOn: timestamp('completed_on'),
  keepUntil: timestamp('keep_until')
    .default(sql`(now() + interval '14 days')`),
}, (t) => [
  unique('task_queue_singleton_key_unique').on(t.singletonKey),
])

export type QueueTask = typeof taskQueueTable.$inferSelect;
export type ImageRecord = typeof imagesTable.$inferSelect;
export type SeriesRecord = typeof seriesTable.$inferSelect;
export type SeasonRecord = typeof seasonsTable.$inferSelect;
export type EpisodeRecord = typeof episodesTable.$inferSelect;

export type DrizzleTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
