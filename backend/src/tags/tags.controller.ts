import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponse, ApiOkResponseWrapped } from '@app/response'
import { UserPermission } from '@app/types/user.permissions'
import { ErrorCode } from '@app/types/error-code.enum'
import { RequirePermission } from '../common/require-permission.decorator'
import { TagsService } from './tags.service'
import ListTagsDto from './dto/list-tags.dto'
import AutocompleteTagsDto from './dto/autocomplete-tags.dto'
import UpdateTagDto from './dto/update-tag.dto'
import TagResponseDto from './dto/tag.response.dto'
import AutocompleteTagResponseDto from './dto/autocomplete-tag.response.dto'

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Full tag list for settings (substring search, keyset pagination)' })
  @ApiOkResponseWrapped(TagResponseDto, { isArray: true })
  async list(@Query() query: ListTagsDto) {
    return this.tagsService.list(query)
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Tag suggestions for input (prefix match, ranked by usage)' })
  @ApiOkResponseWrapped(AutocompleteTagResponseDto, { isArray: true })
  async autocomplete(@Query() query: AutocompleteTagsDto) {
    return this.tagsService.autocomplete(query)
  }

  @Patch(':id')
  @RequirePermission(UserPermission.ManageTags)
  @ApiOperation({ summary: 'Update tag (rename, recategorize, color override)' })
  @ApiParam({ name: 'id', description: 'tag id' })
  @ApiOkResponseWrapped(TagResponseDto)
  @ApiErrorResponse(404, 'Tag not found')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    const updated = await this.tagsService.updateTag(id, {
      newName: dto.name,
      newCategory: dto.category,
      colorOverride: dto.colorOverride,
    })

    if (!updated)
      throw new NotFoundException({ code: ErrorCode.TagNotFound })

    return updated
  }
}
