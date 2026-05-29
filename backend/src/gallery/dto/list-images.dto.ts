import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { ImageSourceType } from '@app/types/image.source-type.enum'

const toStringArray = z
  .union([ z.string(), z.array(z.string()) ])
  .transform((v) => (Array.isArray(v) ? v : [ v ]))
  .optional()

const listImages = z.object({
  tags: toStringArray,
  excludeTags: toStringArray,

  authorId: z.string().optional(),

  seriesId: z.string().optional(),
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),

  sourceType: z.nativeEnum(ImageSourceType).optional(),

  lastSeenId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default class ListImagesDto extends createZodDto(listImages) {}
