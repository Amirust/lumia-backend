import { Injectable, Logger } from '@nestjs/common'
import { TaskType } from '@app/task-queue/task-queue.types'

export type JobHandler<T = unknown> = (job: { id: string, data: T }) => Promise<void>

@Injectable()
export class HandlerRegistry {
  private readonly logger = new Logger('HandlerRegistry')
  private readonly handlers = new Map<string, JobHandler>()

  register(name: TaskType, handler: JobHandler) {
    if (this.handlers.has(name))
      throw new Error('Handler already registered for task type: ' + name)

    this.handlers.set(name, handler)
    this.logger.log(`Registering handler for task type: ${name}`)
  }

  get(name: TaskType): JobHandler {
    const handler = this.handlers.get(name)

    if (!handler)
      throw new Error('No handler registered for task type: ' + name)

    return handler
  }
}
