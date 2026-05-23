import { Controller, Get, Param, Query } from '@nestjs/common'
import { CharactersService } from './characters.service'
import SearchCharacterDto from './dto/search-character.dto'

@Controller('characters')
export class CharactersController {
  constructor(
    private charactersService: CharactersService
  ) {}

  @Get()
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
  async getCharacter(
    @Param('id') id: string
  ) {
    return this.charactersService.findOne(id)
  }
}
