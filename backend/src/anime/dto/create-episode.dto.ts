import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const createEpisode = z.object({
  number: z.coerce.number().int().min(1),
  title: z.string().min(1).max(255).optional(),
})

export default class CreateEpisodeDto extends createZodDto(createEpisode) {}
