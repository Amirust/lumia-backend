import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { CharactersService } from './characters.service'
import SearchCharacterDto from './dto/search-character.dto'
import { CharacterWithTagResponseDto } from './dto/character.response.dto'

@ApiTags('characters')
@Controller('characters')
export class CharactersController {
  constructor(
    private charactersService: CharactersService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List characters' })
  @ApiOkResponseWrapped(CharacterWithTagResponseDto, { isArray: true })
  async getCharacters(
    @Query() query: SearchCharacterDto
  ) {
    return this.charactersService.findMany(
      query.limit,
      {
        name: query.name,
        lastSeenId: query.lastSeenId,
      }
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get character by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(CharacterWithTagResponseDto)
  @ApiNotFoundResponse({ description: 'Character not found' })
  async getCharacter(
    @Param('id') id: string
  ) {
    return this.charactersService.findOne(id)
  }
}
