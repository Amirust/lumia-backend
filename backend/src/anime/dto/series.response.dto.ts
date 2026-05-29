import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

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

export default class SeriesResponseDto extends createZodDto(series) {}
