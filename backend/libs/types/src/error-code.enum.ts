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
}
