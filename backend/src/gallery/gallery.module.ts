import { Module } from '@nestjs/common'
import { GalleryController } from './gallery.controller'
import { ImagesService } from '../images/images.service'

@Module({
  controllers: [ GalleryController ],
  imports: [ ImagesService ]
})
export class GalleryModule {}
