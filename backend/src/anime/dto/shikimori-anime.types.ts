// Subset of fields we consume from the Shikimori API.
// See: https://shikimori.io/api/animes/:id
export interface ShikimoriAnime {
  id: number
  name: string
  russian: string
  english: string[] | null
  japanese: string[] | null
  episodes: number
  episodes_aired: number
  status: 'anons' | 'ongoing' | 'released' | string
  score: string | null
  aired_on: string | null
  released_on: string | null
}

export interface ImportSeriesResult {
  seriesId: string
  seasonId: string
  episodesCreated: number
}

export interface ImportSeasonResult {
  seasonId: string
  episodesCreated: number
}
