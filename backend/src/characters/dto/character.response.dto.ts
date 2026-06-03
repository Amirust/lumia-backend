import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const character = z.object({
  id: z.string(),
  tagId: z.string(),
  displayName: z.string(),
  coverImageId: z.string().nullable(),
})

const characterWithTag = character.extend({
  tag: z.string().nullable(),
  imagesCount: z.number().int(),
})

export default class CharacterResponseDto extends createZodDto(character) {}
export class CharacterWithTagResponseDto extends createZodDto(characterWithTag) {}
