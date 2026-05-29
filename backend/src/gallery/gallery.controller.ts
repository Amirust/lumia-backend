import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { ImagesService } from '../images/images.service'
import ListImagesDto from './dto/list-images.dto'
import ListImagesResponseDto from './dto/list-images.response.dto'

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(
    private imagesService: ImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search/list images with filters (keyset pagination)' })
  @ApiOkResponseWrapped(ListImagesResponseDto)
  async list(@Query() query: ListImagesDto) {
    const { limit, lastSeenId, ...options } = query

    return this.imagesService.findMany(limit, lastSeenId, options)
  }
}
