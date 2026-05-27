import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const updateEpisode = z.object({
  number: z.coerce.number().int().min(1).optional(),
  title: z.string().min(1).max(255).nullable().optional(),
})

export default class UpdateEpisodeDto extends createZodDto(updateEpisode) {}
