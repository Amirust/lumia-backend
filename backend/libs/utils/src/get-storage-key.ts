export const getStorageKey = (hash: string, authorId: string) => {
  return `${authorId}/${hash}`
}

export const getStorageKeyThumbnail = (hash: string, authorId: string) => {
  return `${authorId}/${hash}-thumbnail.webp`
}
