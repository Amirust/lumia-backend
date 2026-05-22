export const getStorageKey = (hash: string, authorId: string) => {
  return `${authorId}/${hash}`
}
