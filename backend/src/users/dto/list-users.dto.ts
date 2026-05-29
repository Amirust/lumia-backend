import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const listUsers = z.object({
  search: z.string().optional(),
  lastSeenId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default class ListUsersDto extends createZodDto(listUsers) {}