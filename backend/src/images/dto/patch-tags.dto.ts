import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const patchTags = z.object({
  add: z.array(z.object({
    name: z.string().min(1).max(255),
    category: z.string().min(1).max(255),
  })).optional(),
  remove: z.array(z.string()).optional(),
})

export default class PatchTagsDto extends createZodDto(patchTags) {}
