import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const listSeries = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  lastSeenId: z.string().optional(),
  search: z.string().optional(),
})

export default class ListSeriesDto extends createZodDto(listSeries) {}
