import { Controller, Param, Sse } from '@nestjs/common'
import { ImagesService } from './images.service'
import { EventsService } from '@app/events'
import { EventKey } from '@app/events/events.types'

@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly events: EventsService,
  ) {}

  // todo upload image, add + remove tags, search, autocomplete, etc

  @Sse(':imageId')
  streamImageEvents(@Param('imageId') imageId: string) {
    return this.events.asObservable(
      EventKey.AiTagsResolved(imageId)
    )
  }
}
