import type { DrizzleDB } from '@app/db'

export enum ShikomoriStatus {
  Anons = 'anons',
  Ongoing = 'ongoing',
  Released = 'released',
}

export type DrizzleTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]

