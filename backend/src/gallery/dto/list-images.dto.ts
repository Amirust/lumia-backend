import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import { ImageSortDirection, ImageSortType } from '../../images/images.types'

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

  // If true, we return only images that have no episode link
  withoutEpisodeLink: z.coerce.boolean().optional(),

  onlyFavorites: z.coerce.boolean().optional(),

  sourceType: z.enum(ImageSourceType).optional(),

  sortDirection: z.enum(ImageSortDirection).default(ImageSortDirection.Descending),
  sortType: z.enum(ImageSortType).default(ImageSortType.CreatedAt),

  lastSeenId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default class ListImagesDto extends createZodDto(listImages) {}
