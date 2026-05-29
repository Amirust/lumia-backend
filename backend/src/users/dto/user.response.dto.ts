import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const user = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  permissions: z.number().int().optional(),
})

export default class UserResponseDto extends createZodDto(user) {}
