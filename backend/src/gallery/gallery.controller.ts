import { Controller } from '@nestjs/common'
import { ImagesService } from '../images/images.service'

@Controller('gallery')
export class GalleryController {
  constructor(
    private imagesService: ImagesService,
  ) {}
}
