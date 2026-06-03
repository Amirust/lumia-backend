import { Module } from '@nestjs/common'
import { ResponseModule } from '@app/response'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DB_CONNECTION, DbModule, DrizzleDB } from '@app/db'
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'
import { getBasicConfig } from '@app/better-auth'
import { createAccessControlConfig } from '@app/better-auth/access-control'
import { snowflake } from '@app/utils/snowflake'
import { createAuthAccessHooks } from './common/auth-access.hooks'
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
      useFactory: (config: ConfigService, db: DrizzleDB)=> ({
        auth: betterAuth({
          ...getBasicConfig(),
          databaseHooks: createAuthAccessHooks({
            db,
            config: createAccessControlConfig({
              APP_WHITELIST_ON: config.get('APP_WHITELIST_ON'),
              APP_WHITELIST: config.get('APP_WHITELIST'),
              APP_BLACKLIST_ON: config.get('APP_BLACKLIST_ON'),
              APP_BLACKLIST: config.get('APP_BLACKLIST'),
            }),
          }),
          trustedOrigins: [ config.getOrThrow('FRONTEND_ORIGIN'), 'http://localhost:3000' ],
          baseURL: config.getOrThrow('BACKEND_URL'),
          socialProviders: {
            discord: {
              clientId: config.getOrThrow('DISCORD_CLIENT_ID'),
              clientSecret: config.getOrThrow('DISCORD_CLIENT_SECRET'),
              overrideUserInfoOnSignIn: true,
              mapProfileToUser: (profile) => {
                const ext = profile.avatar?.startsWith('a_') ? 'gif' : 'png'
                const image = profile.avatar ?
                  `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}?size=512` : null

                return {
                  name: profile.global_name ?? profile.username,
                  username: profile.username,
                  image: image ?? profile.image_url,
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
  providers: [
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
