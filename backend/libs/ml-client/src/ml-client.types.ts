export enum MlClientEndpoint {
  GetTags = 'tags',
  GetThumbnail = 'thumbnail',
}

export enum TagsCategory {
  Rating = 'rating',
  Character = 'character',
  Copyright = 'copyright',
  Artist = 'artist',
  General = 'general',
  Meta = 'meta',
  Year = 'year',
}

export const ML_BODY_FILE_NAME = 'image'

export type GetTagsResult = {
  [k in TagsCategory]: string[];
}
