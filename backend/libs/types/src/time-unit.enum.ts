export enum TimeUnit {
  Ms = 1,
  Second = 1000,
  Minute = 60 * TimeUnit.Second,
  Hour = 60 * TimeUnit.Minute,
  Day = 24 * TimeUnit.Hour,
  Week = 7 * TimeUnit.Day,
  Month = 30 * TimeUnit.Day,
  Year = 365 * TimeUnit.Day,
}
