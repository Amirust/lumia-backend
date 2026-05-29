import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const autocompleteTags = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export default class AutocompleteTagsDto extends createZodDto(autocompleteTags) {}
