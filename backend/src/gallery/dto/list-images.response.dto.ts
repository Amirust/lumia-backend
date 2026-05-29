import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { imageSchema } from '../../images/dto/image.response.dto'

const listImages = z.object({
  images: z.array(imageSchema),
  afterFilter: z.number().int().optional(),
})

export default class ListImagesResponseDto extends createZodDto(listImages) {}
