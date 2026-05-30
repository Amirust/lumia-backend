import sharp from 'sharp'

export const isValidImage = async (buff: Buffer): Promise<boolean> => {
  try {
    await sharp(buff).stats()
    return true
  } catch {
    return false
  }
}
