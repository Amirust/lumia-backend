export const unsafe = (fn: () => any): any => {
  try {
    return fn()
  } catch {
    // Do nothing
  }
}

export const unsafeOrValue = <T>(fn: () => T, defaultValue: T): T => {
  try {
    return fn()
  } catch {
    return defaultValue
  }
}
