import { INestApplication } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import FastifyApiReference from '@scalar/fastify-api-reference'
import { Response, ResponseError } from '@app/response'

const SCALAR_PATH = '/reference'
const JSON_PATH = '/reference/json'

export async function setupOpenApi(app: INestApplication): Promise<void> {
  const config = new DocumentBuilder()
    .setTitle('Lumia API')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build()

  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, config, {
      extraModels: [ Response, ResponseError ],
    }),
  )

  const fastify = (app as NestFastifyApplication).getHttpAdapter().getInstance()

  fastify.get(JSON_PATH, async () => document)

  await fastify.register(FastifyApiReference, {
    routePrefix: SCALAR_PATH,
    configuration: {
      content: document,
    },
  })
}
