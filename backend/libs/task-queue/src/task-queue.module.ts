import { Global, Module } from '@nestjs/common'
import { TaskQueueService } from './task-queue.service'
import { DbModule } from '@app/db'
import { DiscoveryModule } from '@nestjs/core'
import { HandlerRegistry } from '@app/task-queue/handler-registry'
import { TaskQueueWorker } from '@app/task-queue/task-queue.worker'
import { HandlerExplorerService } from '@app/task-queue/handler-explorer.service'

@Global()
@Module({
  providers: [ TaskQueueService, HandlerRegistry, TaskQueueWorker, HandlerExplorerService ],
  exports: [ TaskQueueService ],
  imports: [ DbModule, DiscoveryModule ]
})
export class TaskQueueModule {}
