import { Module } from '@nestjs/common'
import { ImagesService } from './images.service'
import { R2Module } from '@app/r2'
import { MlClientModule } from '@app/ml-client'
import { DbModule } from '@app/db'
import { UsersModule } from '../users/users.module'
import { LruCacheModule } from '@app/lru-cache'
import { TaskQueueModule } from '@app/task-queue'

@Module({
  providers: [ ImagesService ],
  exports: [ ImagesService ],
  imports: [ UsersModule, R2Module, MlClientModule, DbModule, LruCacheModule, TaskQueueModule ],
})
export class ImagesModule {}
