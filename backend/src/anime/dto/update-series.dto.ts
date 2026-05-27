import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const updateSeries = z.object({
  titleRus: z.string().min(1).max(255).optional(),
  titleEng: z.string().min(1).max(255).nullable().optional(),
  titleJap: z.string().min(1).max(255).nullable().optional(),
  rating: z.string().nullable().optional(),
  coverImageId: z.string().nullable().optional(),
})

export default class UpdateSeriesDto extends createZodDto(updateSeries) {}
