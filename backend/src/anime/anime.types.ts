import { EpisodeRecord } from '@app/db/db.schema'

export enum ShikomoriStatus {
  Anons = 'anons',
  Ongoing = 'ongoing',
  Released = 'released',
}

export type EpisodeRecordWithImagesCount = EpisodeRecord & {
  imagesCount: number
  imageId: string | null
}
