import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Session,
  Sse,
} from '@nestjs/common'
import { ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { type FastifyRequest } from 'fastify'
import { type UserSession } from '@thallesp/nestjs-better-auth'
import { ApiErrorResponse, ApiOkResponseWrapped } from '@app/response'
import { ImagesService } from './images.service'
import { EventsService } from '@app/events'
import { EventKey } from '@app/events/events.types'
import { ErrorCode } from '@app/types/error-code.enum'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import PatchTagsDto from './dto/patch-tags.dto'
import UpdateImageDto from './dto/update-image.dto'
import ImageResponseDto from './dto/image.response.dto'
import UploadResponseDto from './dto/upload.response.dto'
import DeleteImageResponseDto from './dto/delete-image.response.dto'
import { isValidImage } from '@app/utils/is-image-valid'

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly events: EventsService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload one or more images (multipart, max 10 files)' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponseWrapped(UploadResponseDto)
  async upload(@Req() req: FastifyRequest, @Session() session: UserSession) {
    if (!req.isMultipart())
      throw new BadRequestException({ code: ErrorCode.NotMultipart })

    const buffers: ArrayBuffer[] = []
    let sourceType: ImageSourceType = ImageSourceType.FanArt
    let episodeId: string | undefined
    let timestampSeconds: number | undefined

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buf = await part.toBuffer()
        buffers.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
      } else {
        if (part.fieldname === 'sourceType') sourceType = part.value as ImageSourceType
        if (part.fieldname === 'episodeId') episodeId = part.value as string
        if (part.fieldname === 'timestampSeconds') timestampSeconds = Number(part.value)
      }
    }

    if (!buffers.length)
      throw new BadRequestException({ code: ErrorCode.NoFilesUploaded })

    const files = buffers
      .map((buffer) => ({
        buffer,
        options: { episodeId, timestampSeconds },
      }))

    const isSomeCorrupted = await Promise.all(files.map(async ({ buffer }) => !(await isValidImage(Buffer.from(buffer, 0, buffer.byteLength)))))
    if (isSomeCorrupted.some((isCorrupted) => isCorrupted))
      throw new BadRequestException({ code: ErrorCode.CorruptedImage })

    const created = await this.imagesService.uploadFiles(files, session.user.id, sourceType)

    return {
      items: created.map((image) => ({
        id: image.id,
        status: image.status,
        storageKey: image.storageKey,
        sourceFormat: image.sourceFormat,
      })),
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single image by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(ImageResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async getImage(@Param('id') id: string) {
    const image = await this.imagesService.findOne(id)

    if (!image)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    return image
  }

  @Patch(':id/tags')
  @ApiOperation({ summary: 'Add / remove / replace tags of an image' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(ImageResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async patchTags(
    @Param('id') id: string,
    @Body() dto: PatchTagsDto,
    @Session() session: UserSession,
  ) {
    return this.imagesService.editTags(id, session.user.id, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update image source type / episode link' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(ImageResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async updateImage(
    @Param('id') id: string,
    @Body() dto: UpdateImageDto,
    @Session() session: UserSession,
  ) {
    return this.imagesService.updateImage(id, session.user.id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an image (owner, or DeleteOthersImages permission)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(DeleteImageResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async deleteImage(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.imagesService.deleteImage(id, session.user.id)
  }

  @Sse(':imageId/events')
  streamImageEvents(@Param('imageId') imageId: string) {
    return this.events.asObservable(
      EventKey.AiTagsResolved(imageId)
    )
  }
}
