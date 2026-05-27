import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const createSeries = z.object({
  titleRus: z.string().min(1).max(255),
  titleEng: z.string().min(1).max(255).optional(),
  titleJap: z.string().min(1).max(255).optional(),
  rating: z.string().optional(),
  coverImageId: z.string().optional(),
})

export default class CreateSeriesDto extends createZodDto(createSeries) {}
