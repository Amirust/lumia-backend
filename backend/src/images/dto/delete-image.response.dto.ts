import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const deleteImage = z.object({
  ok: z.boolean(),
})

export default class DeleteImageResponseDto extends createZodDto(deleteImage) {}
