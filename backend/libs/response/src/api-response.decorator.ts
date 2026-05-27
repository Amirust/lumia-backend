import { applyDecorators, Type } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger'
import { Response, ResponseError } from './response.dto'

interface WrappedOptions {
  isArray?: boolean
  description?: string
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
