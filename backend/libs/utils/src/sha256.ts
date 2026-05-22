export const sha256 = async (input: ArrayBuffer) => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', input)

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
