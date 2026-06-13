import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { LinkByHashStatus } from '../images.types'
import { imageSchema } from './image.response.dto'

const linkByHashItem = z.object({
  hash: z.string(),
  status: z.enum(LinkByHashStatus),
  image: imageSchema.nullable(),
})

const linkByHashResponse = z.object({
  items: z.array(linkByHashItem),
})

export default class LinkByHashResponseDto extends createZodDto(linkByHashResponse) {}
