import { createHmac, timingSafeEqual } from 'crypto'

const TTL_SEC = 3600 // 1 hour

// Tokens expire on a fixed hourly boundary rather than exactly TTL_SEC from the moment of
// minting, so the same photo yields a byte-identical URL for everyone for the whole bucket.
// That URL is the browser's cache key: re-minting a fresh `exp` on every API response
// changed it every time, so the proxy's Cache-Control could never produce a hit.
//
// A token issued anywhere inside a bucket stays valid for at least TTL_SEC (bucket end +
// TTL, less an issue time that is inside the bucket), which is what lets the photo proxy
// cache for slightly under TTL_SEC without a cached response ever outliving its token.
const BUCKET_SEC = 3600

function bucketedExpiry(nowSec: number): number {
  return (Math.floor(nowSec / BUCKET_SEC) + 1) * BUCKET_SEC + TTL_SEC
}

/**
 * Resolve the HMAC signing secret for photo-access tokens.
 *
 * No insecure fallback: this secret gates the public photo proxy. Previously it fell
 * back to DATABASE_PASSWORD (coupling two unrelated secrets) and then to a guessable
 * literal. We now require a dedicated secret and fail closed if it is missing.
 */
function getPhotoSecret(): string {
  const secret = process.env.PHOTO_ACCESS_SECRET
  if (!secret) {
    throw new Error(
      'PHOTO_ACCESS_SECRET is not configured. Set PHOTO_ACCESS_SECRET in the Lambda environment.'
    )
  }
  return secret
}

export function createPhotoToken(photoId: string, jobLogId: string): string {
  const exp = bucketedExpiry(Math.floor(Date.now() / 1000))
  const payload = `${photoId}:${jobLogId}:${exp}`
  const sig = createHmac('sha256', getPhotoSecret()).update(payload).digest('base64url')
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
    const expected = createHmac('sha256', getPhotoSecret()).update(payload).digest('base64url')
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}
