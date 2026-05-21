import { Module } from '@nestjs/common'
import { R2Service } from './r2.service'
import { ConfigModule } from '@nestjs/config'

@Module({
  providers: [ R2Service ],
  exports: [ R2Service ],
  imports: [ ConfigModule ]
})
export class R2Module {}
