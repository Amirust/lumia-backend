import { Injectable } from '@nestjs/common'
import { ReplaySubject } from 'rxjs'
import { EventPayload } from '@app/events/events.types'

@Injectable()
export class EventsService {
  private readonly events$ = new Map<string, ReplaySubject<EventPayload>>()

  asObservable(key: string) {
    if (!this.events$.has(key))
      this.events$.set(key, new ReplaySubject<EventPayload>(100))

    return this.events$.get(key)!.asObservable()
  }

  emit(key: string, event: EventPayload) {
    if (!this.events$.has(key))
      this.events$.set(key, new ReplaySubject<EventPayload>(100))

    this.events$.get(key)!.next(event)
  }
}
