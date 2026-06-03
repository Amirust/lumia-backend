import { getFileMetaFromBuffer } from '@app/utils/get-file-meta-from-buffer'
import { ImageSourceType } from '@app/types/image.source-type.enum'
import { EpisodeRecord, ImageRecord, SeasonRecord, SeriesRecord } from '@app/db/db.schema'
import { TagsCategory } from '@app/ml-client/ml-client.types'

export interface UploadImageOptions {
  episodeId?: string;
  timestampSeconds?: number;
}

export type PreparedUpload = {
  meta: ReturnType<typeof getFileMetaFromBuffer> & {
    id: string
    authorId: string
    storageKey: string
  }
  file: { buffer: ArrayBuffer; options: UploadImageOptions }
}

export enum ImageSortType {
  CreatedAt = 'createdAt',
  TimestampSeconds = 'timestampSeconds',
}

export enum ImageSortDirection {
  Ascending = 'asc',
  Descending = 'desc',
}

export interface FindManyOptions {
  tags?: string[];
  excludeTags?: string[];

  authorId?: string;

  seriesId?: string;
  seasonId?: string;
  episodeId?: string;

  withoutEpisodeLink?: boolean;

  onlyFavorites?: boolean;
  userId?: string;

  sortDirection?: ImageSortDirection;
  sortType?: ImageSortType;

  sourceType?: ImageSourceType;
}

export interface TagWithColor {
  tag: string;
  color?: string;
}

export interface ImageResponse extends ImageRecord {
  tagsByCategory: {
    [category in TagsCategory]?: TagWithColor[]
  }

  series?: SeriesRecord | null
  season?: SeasonRecord | null
  episode?: EpisodeRecord | null
}
