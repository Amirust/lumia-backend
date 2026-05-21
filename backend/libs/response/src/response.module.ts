import { Module } from '@nestjs/common'
import { AllExceptionsFilter } from '@app/response/exception.filter'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseSerializerInterceptor } from '@app/response/response.interceptor'

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseSerializerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class ResponseModule {}
