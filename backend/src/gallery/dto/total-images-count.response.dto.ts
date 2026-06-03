import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const totalImagesDto = z.object({
  total: z.number()
})

export default class GetTotalImagesCountResponseDto extends createZodDto(totalImagesDto) {}
