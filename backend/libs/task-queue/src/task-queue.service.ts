import { Inject, Injectable, Logger } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import {
  GetTagsTaskData,
  GetWebpThumbnailTaskData,
  TaskOptions,
  TaskState,
  TaskType,
} from '@app/task-queue/task-queue.types'
import { taskQueueTable } from '@app/db/db.schema'
import { snowflake } from '@app/utils/snowflake'
import { TaskQueueWorker } from '@app/task-queue/task-queue.worker'

@Injectable()
export class TaskQueueService {
  private readonly logger = new Logger('TaskQueueService')

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly worker: TaskQueueWorker
  ) {}

  send(type: TaskType.GetWebpThumbnail, data: GetWebpThumbnailTaskData, options: TaskOptions): Promise<void>
  send(type: TaskType.GetTags, data: GetTagsTaskData, options: TaskOptions): Promise<void>
  async send(type: TaskType, data: Record<string, any>, options: TaskOptions): Promise<void> {
    const record = await this.db
      .insert(taskQueueTable)
      .values({
        id: snowflake(),

        name: type,
        data,

        state: TaskState.Created,

        ...options
      })
      .onConflictDoNothing()
      .returning()

    if (record.length === 0) {
      this.logger.warn(`Task ${type} with unique key ${options.singletonKey} already exists, skipping`)
      return
    }

    this.logger.log(`Enqueued task ${type} with id ${record[0].id}`)

    this.worker.wake()
  }
}
