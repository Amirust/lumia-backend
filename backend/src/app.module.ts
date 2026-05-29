import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ResponseModule } from '@app/response'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DB_CONNECTION, DbModule } from '@app/db'
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'
import { getBasicConfig } from '@app/better-auth'
import { snowflake } from '@app/utils/snowflake'
import { ImagesModule } from './images/images.module'
import { UsersModule } from './users/users.module'
import { GalleryModule } from './gallery/gallery.module'
import { AnimeModule } from './anime/anime.module'
import { CharactersModule } from './characters/characters.module'
import { TagsService } from './tags/tags.service'
import { TagsModule } from './tags/tags.module'
import { PermissionGuard } from './common/permission.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DbModule,
    ResponseModule,

    AuthModule.forRootAsync({
      imports: [ DbModule ],
      inject: [ ConfigService, DB_CONNECTION ],
      useFactory: (config: ConfigService, db: NodePgDatabase)=> ({
        auth: betterAuth({
          ...getBasicConfig(),
          socialProviders: {
            discord: {
              clientId: config.getOrThrow('DISCORD_CLIENT_ID'),
              clientSecret: config.getOrThrow('DISCORD_CLIENT_SECRET'),
              mapProfileToUser: (profile) => {
                return {
                  name: profile.global_name ?? profile.username,
                  username: profile.username,
                  image: profile.image_url,
                }
              },
            },
          },
          database: drizzleAdapter(db, {
            provider: 'pg'
          }),
          advanced: {
            database: {
              generateId: () => snowflake()
            }
          }
        }),
      })
    }),

    UsersModule,
    ImagesModule,
    GalleryModule,
    AnimeModule,
    CharactersModule,
    TagsModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe
    },
    TagsService,
  ],
})
export class AppModule {}
