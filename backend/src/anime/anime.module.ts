import { Module } from '@nestjs/common'
import { DbModule } from '@app/db'
import { AnimeController } from './anime.controller'
import { AnimeService } from './anime.service'

@Module({
  controllers: [ AnimeController ],
  providers: [ AnimeService ],
  exports: [ AnimeService ],
  imports: [ DbModule ]
})
export class AnimeModule {}
