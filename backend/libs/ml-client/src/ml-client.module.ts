import { Module } from '@nestjs/common'
import { MlClientService } from './ml-client.service'
import { ConfigModule } from '@nestjs/config'

@Module({
  providers: [ MlClientService ],
  exports: [ MlClientService ],
  imports: [ ConfigModule ]
})
export class MlClientModule {}
