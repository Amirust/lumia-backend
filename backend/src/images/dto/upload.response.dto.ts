import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { ImageStatus } from '@app/types/image.status.enum'

const uploadItem = z.object({
  id: z.string(),
  status: z.nativeEnum(ImageStatus),
  storageKey: z.string().nullable(),
  sourceFormat: z.string().nullable(),
})

const upload = z.object({
  items: z.array(uploadItem),
})

export default class UploadResponseDto extends createZodDto(upload) {}
