import { fileMime } from './file-mime'

export const fileExtension = (input: ArrayBuffer, defaultMime?: string): string | undefined => {
  // if a mime was calculated beforehand, use it instead of calculating it again
  const mime = defaultMime ?? fileMime(input)

  switch (mime) {
    case 'unknown':
      return

    default: {
      const parts = mime.split('/')

      if (parts.length > 1)
        return parts[1]

      return
    }
  }
}
