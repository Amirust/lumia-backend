/*
 * We process only images
 */
export const fileMime = (buff: ArrayBuffer): string => {
  const arr = new Uint8Array(buff).subarray(0, 16) // does not create a copy, just a view.
  let header = ''

  for (let i = 0; i < arr.length; i++) {
    header += arr[i].toString(16)
  }

  let result = 'unknown'

  switch (true) {
    case header.startsWith('89504e47'): // png apng
      result = 'image/png'
      break
    case header.startsWith('47494638'): // gif
      result = 'image/gif'
      break
    case header.startsWith('ffd8ffe'): // jpg
      result = 'image/jpeg'
      break
    case header.endsWith('66747970617669660000'): // avif
    case header.endsWith('667479706d6966310000'): // mif1 HEIF avif
      result = 'image/avif'
      break
    case header.endsWith('66747970617669730000'): // avif sequence
      result = 'image/avifs'
      break
    case header.endsWith('6674797068656963'): // heic
    case header.endsWith('6674797068656978'): // heic sequence
    case header.endsWith('667479706865766300'): // hevc (another heic variant)
      result = 'image/heic'
      break
    case !!header.match(/52494646[a-z-A-Z-0-9]*57454250/g): // webp
      result = 'image/webp'
      break
  }

  return result
}
