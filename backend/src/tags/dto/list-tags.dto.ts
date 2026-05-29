import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const listTags = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  lastSeenId: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default class ListTagsDto extends createZodDto(listTags) {}
