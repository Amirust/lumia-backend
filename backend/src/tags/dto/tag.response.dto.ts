import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const tag = z.object({
  id: z.number().int(),
  name: z.string(),
  category: z.string().nullable(),
  usageCount: z.number().int(),
  colorOverride: z.string().nullable(),
})

export default class TagResponseDto extends createZodDto(tag) {}
