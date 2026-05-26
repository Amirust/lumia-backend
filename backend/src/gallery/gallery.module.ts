import { Module } from '@nestjs/common'
import { GalleryController } from './gallery.controller'
import { ImagesModule } from '../images/images.module'

@Module({
  controllers: [ GalleryController ],
  imports: [ ImagesModule ]
})
export class GalleryModule {}
