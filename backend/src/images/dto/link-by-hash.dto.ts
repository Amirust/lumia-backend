import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const MAX_HASHES = 100
const SHA256_REGEX = /^[a-f0-9]{64}$/

const linkByHash = z.object({
  hashes: z
    .array(z.string().trim().toLowerCase().regex(SHA256_REGEX, 'Invalid SHA-256 hash'))
    .min(1)
    .max(MAX_HASHES),
  episodeId: z.string().min(1),
})

export default class LinkByHashDto extends createZodDto(linkByHash) {}
