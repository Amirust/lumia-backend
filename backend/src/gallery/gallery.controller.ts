import { Controller, Get, Query, Session } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { ImagesService } from '../images/images.service'
import ListImagesDto from './dto/list-images.dto'
import ListImagesResponseDto from './dto/list-images.response.dto'
import GetTotalImagesCountResponseDto from './dto/total-images-count.response.dto'
import type { UserSession } from '@thallesp/nestjs-better-auth'

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(
    private imagesService: ImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search/list images with filters (keyset pagination)' })
  @ApiOkResponseWrapped(ListImagesResponseDto)
  async list(
    @Query() query: ListImagesDto,
    @Session() session: UserSession,
  ) {
    const { limit, lastSeenId, ...options } = query

    return this.imagesService.findMany(session.user.id, limit, lastSeenId, options)
  }

  @Get('/total')
  @ApiOperation({ summary: 'Get total number of images for given filters' })
  @ApiOkResponseWrapped(GetTotalImagesCountResponseDto)
  async getTotal() {
    const total = await this.imagesService.getTotalCount()

    return { total }
  }
}
