import { Module } from '@nestjs/common'
import { CharactersService } from './characters.service'
import { CharactersController } from './characters.controller'
import { DbModule } from '@app/db'

@Module({
  controllers: [ CharactersController ],
  providers: [ CharactersService ],
  exports: [ CharactersService ],
  imports: [ DbModule ]
})
export class CharactersModule {}
