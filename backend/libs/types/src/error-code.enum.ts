export enum ErrorCode {
  UNKNOWN = 1,

  UserNotFound = 1001,
  NotEnoughPermissions,

  SeriesNotFound = 2001,
  SeasonNotFound,
  EpisodeNotFound,
  SeriesHasSeasons,
  SeasonHasEpisodes,
  InvalidShikimoriUrl,
  ShikimoriAnimeNotFound,
  ShikimoriRequestFailed,
  ShikimoriAlreadyImported,

  ImageNotFound = 3001,
  NoFilesUploaded,
  NotMultipart,
  CorruptedImage,

  TagNotFound = 4001,

  CharacterNotFound = 5001,
}
