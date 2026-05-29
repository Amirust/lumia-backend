import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

const updatePermissions = z.object({
  permissions: z.number().int().min(0),
})

export default class UpdatePermissionsDto extends createZodDto(updatePermissions) {}