import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const setFavoriteResponse = z.object({
  ok: z.boolean(),
})

export default class SetFavoriteResponseDto extends createZodDto(setFavoriteResponse) {}