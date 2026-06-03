import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import { ImageStatus } from '@app/types/image.status.enum'

const series = z.object({
  id: z.string(),
  titleRus: z.string(),
  titleEng: z.string().nullable(),
  titleJap: z.string().nullable(),
  rating: z.string().nullable(),
  coverImageId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const season = z.object({
  id: z.string(),
  seriesId: z.string(),
  number: z.number().int(),
  title: z.string().nullable(),
  shikimoriId: z.number().int().nullable(),
  status: z.enum([ 'anons', 'ongoing', 'released' ]).nullable(),
  episodesCount: z.number().int().nullable(),
  episodesAired: z.number().int().nullable(),
  airedOn: z.string().nullable(),
  releasedOn: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const episode = z.object({
  id: z.string(),
  seasonId: z.string(),
  number: z.number().int(),
  title: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const tagWithColor = z.object({
  tag: z.string(),
  color: z.string().optional(),
})

export const imageSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  contentHash: z.string(),
  storageKey: z.string().nullable(),
  sourceFormat: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  fileSize: z.number().int().nullable(),
  timestampSeconds: z.number().int().nullable(),
  sourceType: z.enum(ImageSourceType),
  status: z.enum(ImageStatus),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),

  tagsByCategory: z.record(z.string(), z.array(tagWithColor)),
  favorite: z.boolean(),

  series: series.nullable().optional(),
  season: season.nullable().optional(),
  episode: episode.nullable().optional(),
})

export default class ImageResponseDto extends createZodDto(imageSchema) {}
