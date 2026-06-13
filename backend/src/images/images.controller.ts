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
  Put,
  Req,
  Res,
  Session,
  Sse,
} from '@nestjs/common'
import { ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { map } from 'rxjs'
import { type FastifyRequest, type FastifyReply } from 'fastify'
import { AllowAnonymous, type UserSession } from '@thallesp/nestjs-better-auth'
import { ImageStatus } from '@app/types/image.status.enum'
import { ApiErrorResponse, ApiOkResponseWrapped } from '@app/response'
import { ImagesService } from './images.service'
import { EventsService } from '@app/events'
import { ErrorCode } from '@app/types/error-code.enum'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import PatchTagsDto from './dto/patch-tags.dto'
import UpdateImageDto from './dto/update-image.dto'
import SetFavoriteDto from './dto/set-favorite.dto'
import ImageResponseDto from './dto/image.response.dto'
import UploadResponseDto from './dto/upload.response.dto'
import LinkByHashDto from './dto/link-by-hash.dto'
import LinkByHashResponseDto from './dto/link-by-hash.response.dto'
import DeleteImageResponseDto from './dto/delete-image.response.dto'
import SetFavoriteResponseDto from './dto/set-favorite.response.dto'
import { isValidImage } from '@app/utils/is-image-valid'
import {
  ThrottleFavorite,
  ThrottleMutation,
  ThrottlePublic,
  ThrottleStream,
  ThrottleUpload,
} from '../common/throttle/throttle.decorators'

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly events: EventsService,
  ) {}

  @Post('upload')
  @ThrottleUpload()
  @ApiOperation({ summary: 'Upload one or more images (multipart, max 10 files)' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponseWrapped(UploadResponseDto)
  async upload(@Req() req: FastifyRequest, @Session() session: UserSession) {
    if (!req.isMultipart())
      throw new BadRequestException({ code: ErrorCode.NotMultipart })

    const buffers: ArrayBuffer[] = []
    let sourceType: ImageSourceType = ImageSourceType.FanArt

    const timestamps = new Map<number, number>()

    let episodeId: string | undefined

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buf = await part.toBuffer()
        buffers.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
        continue
      }

      if (part.fieldname === 'sourceType') {
        sourceType = part.value as ImageSourceType
        continue
      }

      if (part.fieldname === 'episodeId') {
        episodeId = part.value as string
        continue
      }

      const separatorIndex = part.fieldname.lastIndexOf('-')
      const field = separatorIndex === -1 ? part.fieldname : part.fieldname.slice(0, separatorIndex)
      const index = separatorIndex === -1 ? NaN : parseInt(part.fieldname.slice(separatorIndex + 1))

      if (field === 'timestampSeconds') {
        const seconds = parseInt(part.value as string)
        timestamps.set(index, seconds)
      }
    }

    if (!buffers.length)
      throw new BadRequestException({ code: ErrorCode.NoFilesUploaded })

    const files = buffers
      .map((buffer, index) => ({
        buffer,
        options: {
          episodeId: episodeId,
          timestampSeconds: timestamps.get(index),
        },
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

  @Post('link-by-hash')
  @ThrottleMutation()
  @ApiOperation({ summary: 'Link existing images to an episode by their content hash (max 100)' })
  @ApiOkResponseWrapped(LinkByHashResponseDto)
  @ApiErrorResponse(403, 'Not enough permissions')
  @ApiErrorResponse(404, 'Episode not found')
  async linkByHash(
    @Body() dto: LinkByHashDto,
    @Session() session: UserSession,
  ) {
    const items = await this.imagesService.linkByHash(dto.hashes, dto.episodeId, session.user.id)

    return { items }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single image by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(ImageResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async getImage(
    @Param('id') id: string,
    @Session() session: UserSession
  ) {
    const image = await this.imagesService.findOne(id, session.user.id)

    if (!image)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    return image
  }

  @Get('hash/:hash')
  @ApiOperation({ summary: 'Get a single image by hash' })
  @ApiParam({ name: 'hash' })
  @ApiOkResponseWrapped(ImageResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async getImageByHash(
    @Param('hash') hash: string,
    @Session() session: UserSession
  ) {
    const image = await this.imagesService.findOneByHash(hash.toLowerCase(), session.user.id)

    if (!image)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    return image
  }

  @Get(':id/og')
  @ThrottlePublic()
  @AllowAnonymous()
  @ApiOperation({ summary: 'Public Open Graph metadata for an image link preview' })
  @ApiParam({ name: 'id' })
  @ApiErrorResponse(404, 'Image not found')
  async getImageOg(
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const image = await this.imagesService.findOne(id)

    if (!image || !image.storageKey || image.status !== ImageStatus.Done)
      throw new NotFoundException({ code: ErrorCode.ImageNotFound })

    // Metadata is immutable once the image is processed, so let Cloudflare hold it
    reply.header('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800')

    const title = image.series?.titleRus ?? image.series?.titleEng ?? null

    return {
      id: image.id,
      storageKey: image.storageKey,
      width: image.width,
      height: image.height,
      title,
      episode: image.episode ? { number: image.episode.number, title: image.episode.title } : null,
      season: image.season ? { number: image.season.number } : null,
    }
  }

  @Patch(':id/tags')
  @ThrottleMutation()
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
  @ThrottleMutation()
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

  @Put(':id/favorite')
  @ThrottleFavorite()
  @ApiOperation({ summary: 'Add or remove an image from the current user favorites' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(SetFavoriteResponseDto)
  @ApiErrorResponse(404, 'Image not found')
  async setFavorite(
    @Param('id') id: string,
    @Body() dto: SetFavoriteDto,
    @Session() session: UserSession,
  ) {
    return this.imagesService.setFavorite(id, session.user.id, dto.isFavorite)
  }

  @Delete(':id')
  @ThrottleMutation()
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
  @ThrottleStream()
  streamImageEvents(@Param('imageId') imageId: string) {
    return this.events.asObservable(imageId).pipe(
      map(event => {
        return { data: event }
      }),
    )
  }
}
