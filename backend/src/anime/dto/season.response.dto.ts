import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const animeStatus = z.enum([ 'anons', 'ongoing', 'released' ])

const season = z.object({
  id: z.string(),
  seriesId: z.string(),
  number: z.number().int(),
  title: z.string().nullable(),
  shikimoriId: z.number().int().nullable(),
  status: animeStatus.nullable(),
  episodesCount: z.number().int().nullable(),
  episodesAired: z.number().int().nullable(),
  airedOn: z.string().nullable(),
  releasedOn: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export default class SeasonResponseDto extends createZodDto(season) {}
