import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const patchTags = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
})

export default class PatchTagsDto extends createZodDto(patchTags) {}
