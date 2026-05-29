import { applyDecorators, Type } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, ApiResponse, getSchemaPath } from '@nestjs/swagger'
import { ErrorCode } from '@app/types/error-code.enum'
import { Response, ResponseError } from './response.dto'

interface WrappedOptions {
  isArray?: boolean
  description?: string
}

const errorItemSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'number',
      enum: Object.values(ErrorCode).filter((v) => typeof v === 'number'),
    },
    message: { type: 'string' },
    details: { type: 'array', items: {} },
  },
}

export const ApiOkResponseWrapped = <TModel extends Type<unknown>>(
  model: TModel,
  options: WrappedOptions = {},
) => {
  const resultSchema = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) }

  return applyDecorators(
    ApiExtraModels(Response, ResponseError, model),
    ApiOkResponse({
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(Response) },
          {
            properties: {
              ok: { type: 'boolean', enum: [ true ] },
              result: resultSchema,
              errors: { type: 'array', items: { type: 'object' }, nullable: true },
            },
          },
        ],
      },
    }),
  )
}

export const ApiErrorResponse = (status: number, description?: string) =>
  applyDecorators(
    ApiExtraModels(Response, ResponseError),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(Response) },
          {
            properties: {
              ok: { type: 'boolean', enum: [ false ] },
              result: { type: 'object', nullable: true, example: null },
              errors: { type: 'array', items: errorItemSchema },
            },
          },
        ],
      },
    }),
  )
