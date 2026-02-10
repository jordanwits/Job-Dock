import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.PHOTO_ACCESS_SECRET || process.env.DATABASE_PASSWORD || 'photo-access-fallback'
const TTL_SEC = 3600 // 1 hour

export function createPhotoToken(photoId: string, jobLogId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC
  const payload = `${photoId}:${jobLogId}:${exp}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifyPhotoToken(token: string, photoId: string, jobLogId: string): boolean {
  try {
    const [payloadB64, sig] = token.split('.')
    if (!payloadB64 || !sig) return false
    const payload = Buffer.from(payloadB64, 'base64url').toString()
    const [pId, jId, expStr] = payload.split(':')
    if (pId !== photoId || jId !== jobLogId) return false
    const exp = parseInt(expStr, 10)
    if (exp < Date.now() / 1000) return false
    const expected = createHmac('sha256', SECRET).update(payload).digest('base64url')
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}
