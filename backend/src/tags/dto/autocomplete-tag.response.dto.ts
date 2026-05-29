import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const autocompleteTag = z.object({
  name: z.string(),
  category: z.string().nullable(),
  usageCount: z.number().int(),
  colorOverride: z.string().nullable(),
})

export default class AutocompleteTagResponseDto extends createZodDto(autocompleteTag) {}
