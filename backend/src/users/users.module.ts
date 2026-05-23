import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { DbModule } from '@app/db'

@Module({
  controllers: [ UsersController ],
  providers: [ UsersService ],
  exports: [ UsersService ],
  imports: [ DbModule ]
})
export class UsersModule {}
