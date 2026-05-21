import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const searchCharacter = z.object({
  limit: z.coerce.number().max(50).default(10),
  name: z.string().optional(),
  lastSeenId: z.string().optional(),
})

export default class SearchCharacterDto extends createZodDto(searchCharacter) {}
