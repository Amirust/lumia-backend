import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'
import { Response, ResponseError } from '@app/response/response.dto'
import { FastifyReply } from 'fastify'
import { ErrorCode } from '@app/types/error-code.enum'
import { ZodSerializationException } from 'nestjs-zod'
import { ZodError } from 'zod'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: any, host: ArgumentsHost) {
    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError()
      if (zodError instanceof ZodError)
        this.logger.error(`ZodSerializationException: ${zodError.message}`)
    }

    const response = new Response()
    response.result = null
    response.ok = false
    response.errors = []

    let responseCode = 400

    if (exception instanceof HttpException) {
      const error = new ResponseError()
      error.code = ErrorCode.UNKNOWN
      error.message = exception.message
      error.details = []

      if (exception.getResponse() instanceof Object) {
        const body = exception.getResponse() as {
          code?: ErrorCode
          details?: any[]
          message?: any
        }
        if (body?.code) error.code = body.code
        let details = body.details
        if (Array.isArray(body.message)) {
          details = body.message
        }
        error.details.push(...(details ?? []))
      }

      response.errors.push(error)
      responseCode = exception.getStatus()
    } else if (exception instanceof Error) {
      responseCode = 500
    }

    const reply = host.switchToHttp().getResponse<FastifyReply>()

    this.logger.verbose(
      `Caught an exception - ${exception}`,
      exception?.stack ?? 'no stack',
    )

    reply
      .status(responseCode)
      .header('Content-Type', 'application/json')
      .send({
        ok: response.ok,
        errors: response.errors,
        result: response.result,
      })
  }
}
