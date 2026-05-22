import { fileMime } from '@app/utils/file-mime'
import { getImageDimensions } from '@app/utils/get-image-dimensions'
import { fileExtension } from '@app/utils/file-extension'
import { ImageStatus } from '@app/types/image.status.enum'
import { ImageSourceType } from '@app/types/image.source-type.enum'

export const getFileMetaFromBuffer = (buffer: ArrayBuffer, hash: string, source: ImageSourceType)=> {
  const mime = fileMime(buffer)
  const { width, height } = getImageDimensions(buffer, mime)

  return {
    contentHash: hash,

    mime,
    sourceFormat: fileExtension(buffer, mime),

    width,
    height,
    fileSize: buffer.byteLength,

    sourceType: source,
    tags: [],

    status: ImageStatus.Uploading,
  }
}
