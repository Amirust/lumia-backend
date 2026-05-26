import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const character = z.object({
  id: z.string(),
  tagId: z.string(),
  displayName: z.string(),
  coverImageId: z.string().nullable(),
})

export default class CharacterResponseDto extends createZodDto(character) {}
