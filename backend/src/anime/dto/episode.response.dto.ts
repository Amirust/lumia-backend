import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const episode = z.object({
  id: z.string(),
  seasonId: z.string(),
  number: z.number().int(),
  title: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export default class EpisodeResponseDto extends createZodDto(episode) {}
