import { Module } from '@nestjs/common'
import { ImagesService } from './images.service'
import { R2Module } from '@app/r2'
import { MlClientModule } from '@app/ml-client'
import { DbModule } from '@app/db'
import { UsersModule } from '../users/users.module'
import { TaskQueueModule } from '@app/task-queue'
import { EventsModule } from '@app/events'
import { ImagesController } from './images.controller'
import { CharactersModule } from '../characters/characters.module'

@Module({
  providers: [ ImagesService ],
  exports: [ ImagesService ],
  imports: [ UsersModule, R2Module, MlClientModule, DbModule, TaskQueueModule, EventsModule, CharactersModule ],
  controllers: [ ImagesController ],
})
export class ImagesModule {}
