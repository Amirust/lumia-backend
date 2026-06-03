import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const updateTag = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(255).optional(),
  colorOverride: z.string().nullable().optional(),
})

export default class UpdateTagDto extends createZodDto(updateTag) {}