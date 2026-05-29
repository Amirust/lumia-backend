import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { ImageSourceType } from '@app/types/image.source-type.enum'

const updateImage = z.object({
  episodeId: z.string().nullable().optional(),
  sourceType: z.nativeEnum(ImageSourceType).optional(),
})

export default class UpdateImageDto extends createZodDto(updateImage) {}
