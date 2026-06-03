export enum UserPermission {
  Zero = 0,

  UploadImages = 1 << 0,

  EditOthersImageTags = 1 << 1,
  AssignOthersEpisodeScreenshots = 1 << 2,
  DeleteOthersImages = 1 << 3,

  ManageAnime = 1 << 4,

  ManageTags = 1 << 5,
  ManageCharacters = 1 << 6,

  Administrator = 1 << 30,
}

export const DefaultUserPermissions = UserPermission.UploadImages
