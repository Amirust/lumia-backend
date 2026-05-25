import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { HandlerRegistry } from '@app/task-queue/handler-registry'
import { JobHandlerMetadataKey } from '@app/task-queue/decorators/job.decorator'

@Injectable()
export class HandlerExplorerService implements OnApplicationBootstrap {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly registry: HandlerRegistry
  ) {}

  onApplicationBootstrap() {
    const providers = this.discoveryService.getProviders()

    for (const provider of providers) {
      const { instance } = provider

      if (!instance || typeof instance !== 'object') continue

      const prototype = Object.getPrototypeOf(instance)
      if (!prototype) continue

      const names = this.scanner.getAllMethodNames(prototype)

      for (const name of names) {
        const handlerMeta = this.reflector.get(JobHandlerMetadataKey, prototype[name])

        if (!handlerMeta) continue

        this.registry.register(handlerMeta, instance[name].bind(instance))
      }
    }
  }
}
