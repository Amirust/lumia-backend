import { Module } from '@nestjs/common'
import { CharactersService } from './characters.service'
import { CharactersController } from './characters.controller'
import { DbModule } from '@app/db'
import { TagsModule } from '../tags/tags.module'

@Module({
  controllers: [ CharactersController ],
  providers: [ CharactersService ],
  exports: [ CharactersService ],
  imports: [ DbModule, TagsModule ]
})
export class CharactersModule {}
