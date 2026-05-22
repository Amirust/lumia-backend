/*
 * Maximal 30 flags to avoid a bit-overlap
 */

export const bitmaskHas = (bitmask: number, flag: number): boolean => {
  return (bitmask & flag) === flag
}

export const bitmaskSet = (bitmask: number, flag: number): number => {
  return bitmask | flag
}

export const bitmaskUnset = (bitmask: number, flag: number): number => {
  return bitmask & ~flag
}

export const bitmaskHasQuery = (bitmask: number, flag: number): string => {
  return `(${bitmask} & ${flag}) <> ${flag}`
}
