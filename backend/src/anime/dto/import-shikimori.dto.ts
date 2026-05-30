import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const importShikimori = z.object({
  url: z.url().refine(
    (s) => /shikimori\.(io|one|me)\/animes\/\d+/.test(s),
    { message: 'URL must be a shikimori.io/one/me animes link' },
  ),
})

export default class ImportShikimoriDto extends createZodDto(importShikimori) {}
