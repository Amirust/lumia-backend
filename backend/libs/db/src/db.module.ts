import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DB_CONNECTION } from '@app/db/db.symbol'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './db.schema'

@Module({
  imports: [ ConfigModule ],
  providers: [
    {
      provide: DB_CONNECTION,
      inject: [ ConfigService ],
      useFactory: async (configService: ConfigService) => {
        return drizzle({
          connection: {
            connectionString: configService.getOrThrow<string>('DATABASE'),
          },
          schema: {
            ...schema
          },
          casing: 'snake_case'
        })
      }
    }
  ],
  exports: [ DB_CONNECTION ],
})
export class DbModule {}
