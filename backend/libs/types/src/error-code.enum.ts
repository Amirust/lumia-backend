export enum ErrorCode {
  UNKNOWN = 1,

  UserNotFound = 1001,

  CharacterNotFound = 2001,

  PersonaNotFound = 3001,

  ChatNotFound = 4001,

  MessageNotFound = 5001,
  MessageStreamNotFound,
  MessageNoModel,

  PromptPresetNotFound = 6001,
}
