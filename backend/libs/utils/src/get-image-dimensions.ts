import { fileMime } from './file-mime'

export interface ImageDimensions {
  width: number
  height: number
}

const EMPTY: ImageDimensions = { width: 0, height: 0 }

export const getImageDimensions = (buff: ArrayBuffer, defaultMime?: string): ImageDimensions => {
  const view = new DataView(buff)
  const mime = defaultMime ?? fileMime(buff)

  switch (mime) {
    case 'image/png':
      return readPng(view)
    case 'image/gif':
      return readGif(view)
    case 'image/jpeg':
      return readJpeg(view)
    case 'image/webp':
      return readWebp(view)
    default:
      return EMPTY
  }
}

// width/height are uint32 BE at 16/20.
const readPng = (view: DataView): ImageDimensions => {
  if (view.byteLength < 24) return EMPTY

  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  }
}

// uint16 LE at 6 (width) and 8 (height).
const readGif = (view: DataView): ImageDimensions => {
  if (view.byteLength < 10) return EMPTY

  return {
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
  }
}

// Scan until a SOFn marker, whose payload holds height then width.
const readJpeg = (view: DataView): ImageDimensions => {
  let offset = 2 // skip the FFD8 SOI marker

  while (offset + 8 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return EMPTY

    const marker = view.getUint8(offset + 1)

    // SOF0..SOF15 carry the frame size; DHT (C4), JPG (C8), DAC (CC) do not.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      }
    }

    // Otherwise skip this segment using its 2-byte big-endian length.
    offset += 2 + view.getUint16(offset + 2, false)
  }

  return EMPTY
}

// RIFF container; the chunk fourCC at offset 12 picks the encoding variant.
const readWebp = (view: DataView): ImageDimensions => {
  if (view.byteLength < 30) return EMPTY

  const format = String.fromCharCode(
    view.getUint8(12),
    view.getUint8(13),
    view.getUint8(14),
    view.getUint8(15),
  )

  switch (format) {
    case 'VP8 ': // lossy: two 14-bit LE values at offset 26
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      }

    case 'VP8L': { // lossless: 14-bit-1 fields packed from offset 21
      const bits = view.getUint32(21, true)

      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      }
    }

    case 'VP8X': // extended: two 24-bit-1 LE values at offset 24
      return {
        width: (view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16)) + 1,
        height: (view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16)) + 1,
      }

    default:
      return EMPTY
  }
}
