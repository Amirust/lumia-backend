import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      cors: true,
      bodyParser: false
    },
  )

  const config = app.get<ConfigService>(ConfigService)
  const logger = new Logger('Bootstrap')

  await app.listen(+ config.getOrThrow('APP_PORT'), '0.0.0.0', () => {
    logger.log(`Server is running on ${+ config.getOrThrow('APP_PORT')}`)
  })
}

bootstrap()
