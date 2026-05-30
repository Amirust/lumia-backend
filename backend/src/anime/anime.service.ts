import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DB_CONNECTION, type DrizzleDB } from '@app/db'
import {
  DrizzleTx,
  EpisodeRecord,
  episodesTable,
  screenshotsTable,
  SeasonRecord,
  seasonsTable,
  SeriesRecord,
  seriesTable,
} from '@app/db/db.schema'
import { and, asc, eq, getTableColumns, sql } from 'drizzle-orm'
import { snowflake } from '@app/utils/snowflake'
import { ShikimoriRefreshInterval } from '@app/types/constants'
import { ErrorCode } from '@app/types/error-code.enum'
import type CreateSeriesDto from './dto/create-series.dto'
import type UpdateSeriesDto from './dto/update-series.dto'
import type CreateSeasonDto from './dto/create-season.dto'
import type UpdateSeasonDto from './dto/update-season.dto'
import type CreateEpisodeDto from './dto/create-episode.dto'
import type UpdateEpisodeDto from './dto/update-episode.dto'
import type {
  ImportSeasonResult,
  ImportSeriesResult,
  ShikimoriAnime,
} from './dto/shikimori-anime.types'
import { EpisodeRecordWithImagesCount, ShikomoriStatus } from './anime.types'

interface ListSeriesOptions {
  limit?: number
  lastSeenId?: string
  search?: string
}

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name)

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  /*
   * Series CRUD
   */

  async createSeries(dto: CreateSeriesDto): Promise<SeriesRecord> {
    const [ created ] = await this.db
      .insert(seriesTable)
      .values({
        id: snowflake(),
        titleRus: dto.titleRus,
        titleEng: dto.titleEng,
        titleJap: dto.titleJap,
        rating: dto.rating,
        coverImageId: dto.coverImageId,
      })
      .returning()

    return created
  }

  async findSeriesById(id: string): Promise<SeriesRecord & { seasons: SeasonRecord[] }> {
    const [ series ] = await this.db
      .select()
      .from(seriesTable)
      .where(eq(seriesTable.id, id))

    if (!series)
      throw new NotFoundException({ code: ErrorCode.SeriesNotFound })

    const seasons = await this.db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.seriesId, id))
      .orderBy(asc(seasonsTable.number))

    return { ...series, seasons }
  }

  async findManySeries(options: ListSeriesOptions = {}): Promise<SeriesRecord[]> {
    const limit = options.limit ?? 20

    return this.db
      .select()
      .from(seriesTable)
      .where(and(
        options.lastSeenId ?
          sql`${seriesTable.id}::bigint < ${options.lastSeenId}::bigint` :
          undefined,
        options.search ?
          sql`(${seriesTable.titleRus} ILIKE ${'%' + options.search + '%'} OR ${seriesTable.titleEng} ILIKE ${'%' + options.search + '%'})` :
          undefined,
      ))
      .orderBy(sql`${seriesTable.id}::bigint DESC`)
      .limit(limit)
  }

  async updateSeries(id: string, dto: UpdateSeriesDto): Promise<SeriesRecord> {
    const [ updated ] = await this.db
      .update(seriesTable)
      .set(dto)
      .where(eq(seriesTable.id, id))
      .returning()

    if (!updated)
      throw new NotFoundException({ code: ErrorCode.SeriesNotFound })

    return updated
  }

  async deleteSeries(id: string): Promise<{ ok: true }> {
    const [ child ] = await this.db
      .select({ id: seasonsTable.id })
      .from(seasonsTable)
      .where(eq(seasonsTable.seriesId, id))
      .limit(1)

    if (child)
      throw new ConflictException({ code: ErrorCode.SeriesHasSeasons })

    const [ deleted ] = await this.db
      .delete(seriesTable)
      .where(eq(seriesTable.id, id))
      .returning({ id: seriesTable.id })

    if (!deleted)
      throw new NotFoundException({ code: ErrorCode.SeriesNotFound })

    return { ok: true }
  }

  /*
   * Seasons CRUD
   */

  async createSeason(seriesId: string, dto: CreateSeasonDto): Promise<SeasonRecord> {
    await this.assertSeriesExists(seriesId)

    const [ created ] = await this.db
      .insert(seasonsTable)
      .values({
        id: snowflake(),
        seriesId,
        number: dto.number,
        title: dto.title,
      })
      .returning()

    return created
  }

  async findSeasonById(id: string): Promise<SeasonRecord & { episodes: EpisodeRecord[] }> {
    const [ season ] = await this.db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.id, id))

    if (!season)
      throw new NotFoundException({ code: ErrorCode.SeasonNotFound })

    const episodes = await this.db
      .select()
      .from(episodesTable)
      .where(eq(episodesTable.seasonId, id))
      .orderBy(asc(episodesTable.number))

    void this.refreshSeasonIfStale(season).catch((e) => {
      this.logger.error(`refreshSeasonIfStale failed for ${season.id}: ${e}`)
    })

    return { ...season, episodes }
  }

  async findSeasonsBySeries(seriesId: string): Promise<SeasonRecord[]> {
    await this.assertSeriesExists(seriesId)

    return this.db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.seriesId, seriesId))
      .orderBy(asc(seasonsTable.number))
  }

  async updateSeason(id: string, dto: UpdateSeasonDto): Promise<SeasonRecord> {
    const [ updated ] = await this.db
      .update(seasonsTable)
      .set(dto)
      .where(eq(seasonsTable.id, id))
      .returning()

    if (!updated)
      throw new NotFoundException({ code: ErrorCode.SeasonNotFound })

    return updated
  }

  async deleteSeason(id: string): Promise<{ ok: true }> {
    const [ child ] = await this.db
      .select({ id: episodesTable.id })
      .from(episodesTable)
      .where(eq(episodesTable.seasonId, id))
      .limit(1)

    if (child)
      throw new ConflictException({ code: ErrorCode.SeasonHasEpisodes })

    const [ deleted ] = await this.db
      .delete(seasonsTable)
      .where(eq(seasonsTable.id, id))
      .returning({ id: seasonsTable.id })

    if (!deleted)
      throw new NotFoundException({ code: ErrorCode.SeasonNotFound })

    return { ok: true }
  }

  /*
   * Episodes CRUD
   */

  async createEpisode(seasonId: string, dto: CreateEpisodeDto): Promise<EpisodeRecord> {
    await this.assertSeasonExists(seasonId)

    const [ created ] = await this.db
      .insert(episodesTable)
      .values({
        id: snowflake(),
        seasonId,
        number: dto.number,
        title: dto.title,
      })
      .returning()

    return created
  }

  async findEpisodeById(id: string): Promise<EpisodeRecord> {
    const [ episode ] = await this.db
      .select()
      .from(episodesTable)
      .where(eq(episodesTable.id, id))

    if (!episode)
      throw new NotFoundException({ code: ErrorCode.EpisodeNotFound })

    return episode
  }

  async findEpisodesBySeason(seasonId: string): Promise<EpisodeRecordWithImagesCount[]> {
    await this.assertSeasonExists(seasonId)

    return this.db
      .select({
        ...getTableColumns(episodesTable),
        imagesCount: sql<number>`COUNT(${screenshotsTable.id})`,
      })
      .from(episodesTable)
      .where(eq(episodesTable.seasonId, seasonId))
      .leftJoin(screenshotsTable, eq(screenshotsTable.episodeId, episodesTable.id))
      .orderBy(asc(episodesTable.number))
  }

  async updateEpisode(id: string, dto: UpdateEpisodeDto): Promise<EpisodeRecord> {
    const [ updated ] = await this.db
      .update(episodesTable)
      .set(dto)
      .where(eq(episodesTable.id, id))
      .returning()

    if (!updated)
      throw new NotFoundException({ code: ErrorCode.EpisodeNotFound })

    return updated
  }

  async deleteEpisode(id: string): Promise<{ ok: true }> {
    const [ deleted ] = await this.db
      .delete(episodesTable)
      .where(eq(episodesTable.id, id))
      .returning({ id: episodesTable.id })

    if (!deleted)
      throw new NotFoundException({ code: ErrorCode.EpisodeNotFound })

    return { ok: true }
  }

  /*
   * Shikimori import
   */

  async importSeriesFromShikimori(url: string): Promise<ImportSeriesResult> {
    const shikimoriId = this.parseShikimoriUrl(url)
    await this.assertShikimoriNotImported(shikimoriId)

    const data = await this.fetchShikimoriAnime(shikimoriId)

    return this.db.transaction(async (tx) => {
      const seriesId = snowflake()
      await tx.insert(seriesTable).values({
        id: seriesId,
        ...this.mapShikimoriToSeries(data),
      })

      const { seasonId, episodesCreated } = await this.insertSeasonWithEpisodes(tx, {
        seriesId,
        number: 1,
        data,
      })

      return { seriesId, seasonId, episodesCreated }
    })
  }

  async importSeasonFromShikimori(seriesId: string, url: string): Promise<ImportSeasonResult> {
    const shikimoriId = this.parseShikimoriUrl(url)

    const [ series ] = await this.db
      .select({ id: seriesTable.id, rating: seriesTable.rating })
      .from(seriesTable)
      .where(eq(seriesTable.id, seriesId))

    if (!series)
      throw new NotFoundException({ code: ErrorCode.SeriesNotFound })

    await this.assertShikimoriNotImported(shikimoriId)

    const data = await this.fetchShikimoriAnime(shikimoriId)

    return this.db.transaction(async (tx) => {
      const [ maxRow ] = await tx
        .select({ maxNumber: sql<number>`COALESCE(MAX(${seasonsTable.number}), 0)` })
        .from(seasonsTable)
        .where(eq(seasonsTable.seriesId, seriesId))

      const nextNumber = (maxRow?.maxNumber ?? 0) + 1

      const { seasonId, episodesCreated } = await this.insertSeasonWithEpisodes(tx, {
        seriesId,
        number: nextNumber,
        data,
      })

      // Backfill series rating only if it was missing.
      if (!series.rating && data.score)
        await tx
          .update(seriesTable)
          .set({ rating: data.score })
          .where(eq(seriesTable.id, seriesId))

      return { seasonId, episodesCreated }
    })
  }
  
  private async insertSeasonWithEpisodes(
    tx: DrizzleTx,
    args: { seriesId: string; number: number; data: ShikimoriAnime },
  ): Promise<{ seasonId: string; episodesCreated: number }> {
    const seasonId = snowflake()

    await tx.insert(seasonsTable).values({
      id: seasonId,
      seriesId: args.seriesId,
      number: args.number,
      ...this.mapShikimoriToSeason(args.data),
    })

    const episodeCount = this.getEpisodeCount(args.data)
    if (episodeCount === 0) return { seasonId, episodesCreated: 0 }

    const episodeRows = Array.from({ length: episodeCount }, (_, i) => ({
      id: snowflake(),
      seasonId,
      number: i + 1,
    }))
    await tx.insert(episodesTable).values(episodeRows)

    return { seasonId, episodesCreated: episodeRows.length }
  }

  private async assertShikimoriNotImported(shikimoriId: number): Promise<void> {
    const [ existing ] = await this.db
      .select({ seriesId: seasonsTable.seriesId })
      .from(seasonsTable)
      .where(eq(seasonsTable.shikimoriId, shikimoriId))

    if (existing)
      throw new ConflictException({
        code: ErrorCode.ShikimoriAlreadyImported,
        seriesId: existing.seriesId,
      })
  }

  /*
   * Helpers
   */

  private async assertSeriesExists(id: string): Promise<void> {
    const [ row ] = await this.db
      .select({ id: seriesTable.id })
      .from(seriesTable)
      .where(eq(seriesTable.id, id))

    if (!row)
      throw new NotFoundException({ code: ErrorCode.SeriesNotFound })
  }

  private async assertSeasonExists(id: string): Promise<void> {
    const [ row ] = await this.db
      .select({ id: seasonsTable.id })
      .from(seasonsTable)
      .where(eq(seasonsTable.id, id))

    if (!row)
      throw new NotFoundException({ code: ErrorCode.SeasonNotFound })
  }

  private parseShikimoriUrl(url: string): number {
    const match = url.match(/animes\/(\d+)/)

    if (!match)
      throw new BadRequestException({ code: ErrorCode.InvalidShikimoriUrl })

    return Number(match[1])
  }

  private async fetchShikimoriAnime(id: number): Promise<ShikimoriAnime> {
    const baseUrl = this.configService.get<string>('SHIKIMORI_API_URL')

    let res: Response
    try {
      res = await fetch(`${baseUrl}/animes/${id}`, {
        headers: {
          'Accept': 'application/json',
        },
      })
    } catch {
      throw new BadGatewayException({ code: ErrorCode.ShikimoriRequestFailed })
    }

    if (res.status === 404)
      throw new NotFoundException({ code: ErrorCode.ShikimoriAnimeNotFound })

    if (!res.ok)
      throw new BadGatewayException({
        code: ErrorCode.ShikimoriRequestFailed,
        status: res.status,
      })

    return (await res.json()) as ShikimoriAnime
  }

  private mapShikimoriToSeries(data: ShikimoriAnime) {
    return {
      titleRus: data.russian || data.name,
      titleEng: data.english?.[0] ?? data.name,
      titleJap: data.japanese?.[0] ?? null,
      rating: data.score ?? null,
    }
  }

  private mapShikimoriToSeason(data: ShikimoriAnime) {
    return {
      shikimoriId: data.id,
      status: this.normalizeStatus(data.status),
      episodesCount: data.episodes ?? null,
      episodesAired: data.episodes_aired ?? null,
      airedOn: data.aired_on ?? null,
      releasedOn: data.released_on ?? null,
    }
  }

  private normalizeStatus(status: string | null | undefined): ShikomoriStatus | null {
    if (!status) return null

    switch (status) {
      case 'anons':
        return ShikomoriStatus.Anons
      case 'ongoing':
        return ShikomoriStatus.Ongoing
      case 'released':
        return ShikomoriStatus.Released
      default:
        this.logger.warn(`Unknown Shikimori status: ${status}`)
        return null
    }
  }

  private getEpisodeCount(data: ShikimoriAnime): number {
    if (data.status === 'released') return data.episodes ?? data.episodes_aired ?? 0

    return data.episodes_aired ?? data.episodes ?? 0
  }

  private async ensureEpisodes(seasonId: string, count: number): Promise<number> {
    if (count <= 0) return 0

    const existing = await this.db
      .select({ number: episodesTable.number })
      .from(episodesTable)
      .where(eq(episodesTable.seasonId, seasonId))

    const existingNumbers = new Set(existing.map((e) => e.number))
    const toCreate: Array<{ id: string; seasonId: string; number: number }> = []

    for (let n = 1; n <= count; n++)
      if (!existingNumbers.has(n))
        toCreate.push({ id: snowflake(), seasonId, number: n })

    if (toCreate.length === 0) return 0

    await this.db.insert(episodesTable).values(toCreate)
    return toCreate.length
  }

  private async refreshSeasonIfStale(season: SeasonRecord): Promise<void> {
    if (!season.shikimoriId) return
    if (Date.now() - season.updatedAt.getTime() < ShikimoriRefreshInterval) return

    const data = await this.fetchShikimoriAnime(season.shikimoriId)
    const seasonValues = this.mapShikimoriToSeason(data)

    await this.db
      .update(seasonsTable)
      .set(seasonValues)
      .where(eq(seasonsTable.id, season.id))

    const created = await this.ensureEpisodes(season.id, this.getEpisodeCount(data))
    this.logger.log(`Refreshed season ${season.id} from Shikimori (${created} new episodes)`)
  }
}
