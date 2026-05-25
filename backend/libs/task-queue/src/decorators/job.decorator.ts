import { SetMetadata } from '@nestjs/common'

export const JobHandlerMetadataKey = Symbol('JobHandler')

export const JobHandler = (jobName: string): MethodDecorator => {
  return (target, propertyKey, descriptor) => {
    SetMetadata(JobHandlerMetadataKey, jobName)(target, propertyKey, descriptor)
  }
}
