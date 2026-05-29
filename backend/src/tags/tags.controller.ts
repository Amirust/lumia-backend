import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { TagsService } from './tags.service'
import ListTagsDto from './dto/list-tags.dto'
import AutocompleteTagsDto from './dto/autocomplete-tags.dto'
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
}
