import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { SSE_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { map, Observable } from 'rxjs'

@Injectable()
export class ResponseSerializerInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isSse = this.reflector.get<boolean>(SSE_METADATA, context.getHandler())
    if (isSse) return next.handle()

    return next.handle().pipe(
      map((result) => ({
        ok: true,
        errors: [],
        result,
      })),
    )
  }
}
