import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const setFavorite = z.object({
  isFavorite: z.boolean(),
})

export default class SetFavoriteDto extends createZodDto(setFavorite) {}