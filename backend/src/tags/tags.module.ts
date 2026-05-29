import { Module } from '@nestjs/common'
import { TagsController } from './tags.controller'
import { TagsService } from './tags.service'
import { DbModule } from '@app/db'

@Module({
  controllers: [ TagsController ],
  exports: [ TagsService ],
  providers: [ TagsService ],
  imports: [ DbModule ]
})
export class TagsModule {}
