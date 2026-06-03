import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const episode = z.object({
  id: z.string(),
  seasonId: z.string(),
  number: z.number().int(),
  title: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const episodeWithImagesCount = episode.extend({
  imagesCount: z.number().int(),
  imageId: z.string().nullable(),
})

export default class EpisodeResponseDto extends createZodDto(episode) {}

export class EpisodeWithImagesCountResponseDto extends createZodDto(episodeWithImagesCount) {}
