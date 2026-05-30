export enum EventType {
  AiTagsResolved = 'ai-tags-resolved'
}

export const EventKey = {
  AiTagsResolved: (imageId: string) => `image:${imageId}:ai-tags-resolved`
}

export interface EventPayload {
  type: EventType;
  data: any;
}
