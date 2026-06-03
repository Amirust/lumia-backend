import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import multipart from '@fastify/multipart'
import { MaxFileCountPerTransaction, MaxFileSize } from '@app/types/constants'
import { setupOpenApi } from './openapi/setup'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      bodyParser: false
    },
  )

  const config = app.get<ConfigService>(ConfigService)

  app.enableCors({
    origin: [ config.getOrThrow('FRONTEND_ORIGIN'), 'http://localhost:3000' ],
    methods: [ 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS' ],
    allowedHeaders: [ 'Content-Type', 'Authorization' ],
    credentials: true,
  })

  await app.register(multipart, {
    limits: { fileSize: MaxFileSize, files: MaxFileCountPerTransaction },
  })

  const logger = new Logger('Bootstrap')

  if (config.get('OPENAPI_ENABLED') === 'true') {
    await setupOpenApi(app)
    logger.log('OpenAPI / Scalar reference enabled at /reference')
  }

  await app.listen(+ config.getOrThrow('APP_PORT'), '0.0.0.0', () => {
    logger.log(`Server is running on ${+ config.getOrThrow('APP_PORT')}`)
  })
}

bootstrap()
