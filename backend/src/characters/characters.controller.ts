import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponse, ApiOkResponseWrapped } from '@app/response'
import { UserPermission } from '@app/types/user.permissions'
import { ErrorCode } from '@app/types/error-code.enum'
import { RequirePermission } from '../common/require-permission.decorator'
import { ThrottleAdminMutation, ThrottleSearch } from '../common/throttle/throttle.decorators'
import { CharactersService } from './characters.service'
import SearchCharacterDto from './dto/search-character.dto'
import UpdateCharacterDto from './dto/update-character.dto'
import CharacterResponseDto, { CharacterWithTagResponseDto } from './dto/character.response.dto'

@ApiTags('characters')
@Controller('characters')
export class CharactersController {
  constructor(
    private charactersService: CharactersService
  ) {}

  @Get()
  @ThrottleSearch()
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

  @Get('by-tag/:tag')
  @ApiOperation({ summary: 'Get character by tag' })
  @ApiParam({ name: 'tag' })
  @ApiOkResponseWrapped(CharacterWithTagResponseDto)
  @ApiNotFoundResponse({ description: 'Character not found' })
  async getCharacterByTag(
    @Param('tag') tag: string
  ) {
    return this.charactersService.findOneByTag(tag)
  }

  @Patch(':id')
  @ThrottleAdminMutation()
  @RequirePermission(UserPermission.ManageCharacters)
  @ApiOperation({ summary: 'Update character (rename, set cover image)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(CharacterResponseDto)
  @ApiErrorResponse(404, 'Character not found')
  async updateCharacter(
    @Param('id') id: string,
    @Body() dto: UpdateCharacterDto,
  ) {
    const updated = await this.charactersService.update(id, dto)

    if (!updated)
      throw new NotFoundException({ code: ErrorCode.CharacterNotFound })

    return updated
  }

  @Delete(':id')
  @ThrottleAdminMutation()
  @RequirePermission(UserPermission.ManageCharacters)
  @ApiOperation({ summary: 'Delete character' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(CharacterResponseDto)
  @ApiErrorResponse(404, 'Character not found')
  async deleteCharacter(
    @Param('id') id: string,
  ) {
    const deleted = await this.charactersService.delete(id)

    if (!deleted)
      throw new NotFoundException({ code: ErrorCode.CharacterNotFound })

    return deleted
  }
}
