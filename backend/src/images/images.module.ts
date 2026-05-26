import { Module } from '@nestjs/common'
import { ImagesService } from './images.service'
import { R2Module } from '@app/r2'
import { MlClientModule } from '@app/ml-client'
import { DbModule } from '@app/db'
import { UsersModule } from '../users/users.module'
import { TaskQueueModule } from '@app/task-queue'
import { EventsModule } from '@app/events'
import { ImagesController } from './images.controller'

@Module({
  providers: [ ImagesService ],
  exports: [ ImagesService ],
  imports: [ UsersModule, R2Module, MlClientModule, DbModule, TaskQueueModule, EventsModule ],
  controllers: [ ImagesController ],
})
export class ImagesModule {}
