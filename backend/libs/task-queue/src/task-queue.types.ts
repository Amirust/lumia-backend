export enum TaskType {
  GetWebpThumbnail = 'get-webp-thumbnail',
  GetTags = 'get-tags',
}

export enum TaskState {
  Created = 'created',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Retry = 'retry',
  Failed = 'failed',
}

export interface TaskOptions {
  retryLimit?: number
  retryDelay?: number

  startAfter?: Date

  singletonKey: string
}

export interface GetWebpThumbnailTaskData {
  imageId: string
}

export interface GetTagsTaskData {
  imageId: string
}
