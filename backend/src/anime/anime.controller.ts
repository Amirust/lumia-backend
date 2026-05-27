import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { ApiOkResponseWrapped } from '@app/response'
import { AnimeService } from './anime.service'
import CreateSeriesDto from './dto/create-series.dto'
import UpdateSeriesDto from './dto/update-series.dto'
import ListSeriesDto from './dto/list-series.dto'
import SeriesResponseDto from './dto/series.response.dto'
import CreateSeasonDto from './dto/create-season.dto'
import UpdateSeasonDto from './dto/update-season.dto'
import SeasonResponseDto from './dto/season.response.dto'
import CreateEpisodeDto from './dto/create-episode.dto'
import UpdateEpisodeDto from './dto/update-episode.dto'
import EpisodeResponseDto from './dto/episode.response.dto'
import ImportShikimoriDto from './dto/import-shikimori.dto'

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(
    private readonly animeService: AnimeService,
  ) {}

  /* -------------------------------- Series ------------------------------- */

  @Post('series')
  @ApiOperation({ summary: 'Create series manually' })
  @ApiOkResponseWrapped(SeriesResponseDto)
  async createSeries(@Body() dto: CreateSeriesDto) {
    return this.animeService.createSeries(dto)
  }

  @Get('series')
  @ApiOperation({ summary: 'List series with keyset pagination' })
  @ApiOkResponseWrapped(SeriesResponseDto, { isArray: true })
  async listSeries(@Query() query: ListSeriesDto) {
    return this.animeService.findManySeries(query)
  }

  @Get('series/:id')
  @ApiOperation({ summary: 'Get series with its seasons' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(SeriesResponseDto)
  @ApiNotFoundResponse({ description: 'Series not found' })
  async getSeries(@Param('id') id: string) {
    return this.animeService.findSeriesById(id)
  }

  @Patch('series/:id')
  @ApiOperation({ summary: 'Update series' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(SeriesResponseDto)
  @ApiNotFoundResponse({ description: 'Series not found' })
  async updateSeries(@Param('id') id: string, @Body() dto: UpdateSeriesDto) {
    return this.animeService.updateSeries(id, dto)
  }

  @Delete('series/:id')
  @ApiOperation({ summary: 'Delete series (fails if seasons exist)' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Series not found' })
  @ApiConflictResponse({ description: 'Series has child seasons' })
  async deleteSeries(@Param('id') id: string) {
    return this.animeService.deleteSeries(id)
  }

  @Post('series/import')
  @ApiOperation({ summary: 'Import a new series from a Shikimori URL' })
  @ApiConflictResponse({ description: 'This shikimori anime is already imported' })
  async importSeries(@Body() dto: ImportShikimoriDto) {
    return this.animeService.importSeriesFromShikimori(dto.url)
  }

  /* -------------------------------- Seasons ------------------------------ */

  @Post('series/:id/seasons')
  @ApiOperation({ summary: 'Create season under a series' })
  @ApiParam({ name: 'id', description: 'series id' })
  @ApiOkResponseWrapped(SeasonResponseDto)
  @ApiNotFoundResponse({ description: 'Series not found' })
  async createSeason(@Param('id') seriesId: string, @Body() dto: CreateSeasonDto) {
    return this.animeService.createSeason(seriesId, dto)
  }

  @Get('series/:id/seasons')
  @ApiOperation({ summary: 'List seasons of a series' })
  @ApiParam({ name: 'id', description: 'series id' })
  @ApiOkResponseWrapped(SeasonResponseDto, { isArray: true })
  @ApiNotFoundResponse({ description: 'Series not found' })
  async listSeasons(@Param('id') seriesId: string) {
    return this.animeService.findSeasonsBySeries(seriesId)
  }

  @Post('series/:id/seasons/import')
  @ApiOperation({ summary: 'Import an additional season into an existing series from Shikimori' })
  @ApiParam({ name: 'id', description: 'series id' })
  @ApiNotFoundResponse({ description: 'Series not found' })
  @ApiConflictResponse({ description: 'This shikimori anime is already imported' })
  async importSeason(@Param('id') seriesId: string, @Body() dto: ImportShikimoriDto) {
    return this.animeService.importSeasonFromShikimori(seriesId, dto.url)
  }

  @Get('seasons/:id')
  @ApiOperation({ summary: 'Get season with episodes (triggers lazy Shikimori refresh if stale)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(SeasonResponseDto)
  @ApiNotFoundResponse({ description: 'Season not found' })
  async getSeason(@Param('id') id: string) {
    return this.animeService.findSeasonById(id)
  }

  @Patch('seasons/:id')
  @ApiOperation({ summary: 'Update season' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(SeasonResponseDto)
  @ApiNotFoundResponse({ description: 'Season not found' })
  async updateSeason(@Param('id') id: string, @Body() dto: UpdateSeasonDto) {
    return this.animeService.updateSeason(id, dto)
  }

  @Delete('seasons/:id')
  @ApiOperation({ summary: 'Delete season (fails if episodes exist)' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Season not found' })
  @ApiConflictResponse({ description: 'Season has child episodes' })
  async deleteSeason(@Param('id') id: string) {
    return this.animeService.deleteSeason(id)
  }

  /* -------------------------------- Episodes ----------------------------- */

  @Post('seasons/:id/episodes')
  @ApiOperation({ summary: 'Create episode under a season' })
  @ApiParam({ name: 'id', description: 'season id' })
  @ApiOkResponseWrapped(EpisodeResponseDto)
  @ApiNotFoundResponse({ description: 'Season not found' })
  async createEpisode(@Param('id') seasonId: string, @Body() dto: CreateEpisodeDto) {
    return this.animeService.createEpisode(seasonId, dto)
  }

  @Get('seasons/:id/episodes')
  @ApiOperation({ summary: 'List episodes of a season' })
  @ApiParam({ name: 'id', description: 'season id' })
  @ApiOkResponseWrapped(EpisodeResponseDto, { isArray: true })
  @ApiNotFoundResponse({ description: 'Season not found' })
  async listEpisodes(@Param('id') seasonId: string) {
    return this.animeService.findEpisodesBySeason(seasonId)
  }

  @Get('episodes/:id')
  @ApiOperation({ summary: 'Get episode by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(EpisodeResponseDto)
  @ApiNotFoundResponse({ description: 'Episode not found' })
  async getEpisode(@Param('id') id: string) {
    return this.animeService.findEpisodeById(id)
  }

  @Patch('episodes/:id')
  @ApiOperation({ summary: 'Update episode' })
  @ApiParam({ name: 'id' })
  @ApiOkResponseWrapped(EpisodeResponseDto)
  @ApiNotFoundResponse({ description: 'Episode not found' })
  async updateEpisode(@Param('id') id: string, @Body() dto: UpdateEpisodeDto) {
    return this.animeService.updateEpisode(id, dto)
  }

  @Delete('episodes/:id')
  @ApiOperation({ summary: 'Delete episode' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Episode not found' })
  async deleteEpisode(@Param('id') id: string) {
    return this.animeService.deleteEpisode(id)
  }
}
