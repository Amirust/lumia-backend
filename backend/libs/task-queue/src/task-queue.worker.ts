import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import { ConfigService } from '@nestjs/config'
import { QueueTask, taskQueueTable } from '@app/db/db.schema'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { TaskState, TaskType } from '@app/task-queue/task-queue.types'
import { HandlerRegistry } from '@app/task-queue/handler-registry'

@Injectable()
export class TaskQueueWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('TaskQueueWorker')

  private stopping = false
  private inflight = 0
  private readonly concurrency: number

  private maintenanceTimer: NodeJS.Timeout

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly handlerRegistry: HandlerRegistry
  ) {
    this.concurrency = this.configService.get<number>('TASK_QUEUE_WORKER_CONCURRENCY') || 1
  }

  wake() {
    if (this.stopping) queueMicrotask(() => this.drain())
  }

  private async drain() {
    while (!this.stopping && this.inflight < this.concurrency) {
      const slots = this.concurrency - this.inflight
      const jobs = await this.fetch(slots)

      if (!jobs.length) return

      this.inflight += jobs.length

      for (const job of jobs)
        this.run(job).finally(() => {
          this.inflight--
          this.wake()
        })
    }
  }

  async run(job: QueueTask) {
    const handler = this.handlerRegistry.get(job.name as TaskType)

    if (!handler) {
      await this.markFailed(job, new Error(`No handler found for task ${job.name}`))
      return
    }

    try {
      await handler(job)
    } catch (error) {
      await this.markFailed(job, error)
    } finally {
      await this.makeDone(job)
    }
  }

  private async fetch(limit: number) {
    const next = this.db.$with('next').as(
      this.db
        .select({ id: taskQueueTable.id })
        .from(taskQueueTable)
        .where(and(inArray(taskQueueTable.state, [ TaskState.Created, TaskState.Retry ]), lt(taskQueueTable.startAfter, sql`now()`)))
        .orderBy(taskQueueTable.startAfter, taskQueueTable.id)
        .limit(limit)
        .for('update', { skipLocked: true }),
    )

    return this.db
      .with(next)
      .update(taskQueueTable)
      .set({
        state: 'active',
        startedOn: sql`now()`,
        retryCount: sql`
        CASE WHEN ${taskQueueTable.state} = 'retry'
             THEN ${taskQueueTable.retryCount} + 1
             ELSE ${taskQueueTable.retryCount}
        END`,
      })
      .from(next)
      .where(eq(taskQueueTable.id, next.id))
      .returning()
  }

  private async maintenance() {
    await this.db
      .update(taskQueueTable)
      .set({
        state: sql`(CASE WHEN ${taskQueueTable.retryCount} < ${taskQueueTable.retryLimit} THEN ${TaskState.Retry} ELSE ${TaskState.Failed} END)::task_state`,
        startedOn: null,
      })
      .where(
        and(
          eq(taskQueueTable.state, TaskState.Active),
          lt(sql`${taskQueueTable.startedOn} + ${taskQueueTable.expireIn}`, sql`now()`),
        ),
      )

    await this.drain()
  }

  private async makeDone(job: QueueTask) {
    await this.db
      .update(taskQueueTable)
      .set({
        state: TaskState.Completed,
        completedOn: new Date()
      })
      .where(eq(taskQueueTable.id, job.id))
      .execute()
  }

  private async markFailed(job: QueueTask, error: unknown) {
    await this.db
      .update(taskQueueTable)
      .set({
        state: TaskState.Retry,
        startedOn: null,
      })
      .where(eq(taskQueueTable.id, job.id))
      .execute()

    this.logger.error(`Error processing task ${job.id}:`, error)
  }

  private async drainInflight(timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs
    while (this.inflight > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100))
    }

    if (this.inflight > 0)
      this.logger.warn(`drain timed out with ${this.inflight} jobs still running`)
  }


  async onApplicationBootstrap() {
    await this.db
      .update(taskQueueTable)
      .set({
        state: TaskState.Retry,
        startedOn: null,
      })
      .where(
        eq(taskQueueTable.state, TaskState.Active),
      )
      .execute()

    await this.drain()

    const tick = () => {
      if (this.stopping) return
      this.maintenance()
        .catch((e) => this.logger.error('maintenance failed', e))
        .finally(() => {
          this.maintenanceTimer = setTimeout(tick, 15_000)
        })
    }
    tick()
  }

  async onModuleDestroy() {
    this.stopping = true
    clearTimeout(this.maintenanceTimer)
    await this.drainInflight()
  }
}
