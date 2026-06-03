import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const updateCharacter = z.object({
  name: z.string().min(1).max(255).optional(),
  imageId: z.string().optional(),
})

export default class UpdateCharacterDto extends createZodDto(updateCharacter) {}