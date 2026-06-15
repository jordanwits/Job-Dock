// AES-256-GCM encryption for QuickBooks OAuth tokens stored at rest in the database.
// Fails closed when the key is missing (matches the APPROVAL_SECRET "no insecure fallback"
// convention used elsewhere in this codebase).
//
// Stored format: base64(iv) "." base64(authTag) "." base64(ciphertext)

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

function getKey(): Buffer {
  const raw = process.env.QUICKBOOKS_TOKEN_ENC_KEY || ''
  if (!raw) {
    throw new Error(
      'QUICKBOOKS_TOKEN_ENC_KEY is not set; refusing to read/write QuickBooks tokens'
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('QUICKBOOKS_TOKEN_ENC_KEY must decode to 32 bytes (base64 of 32 random bytes)')
  }
  return key
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = (payload || '').split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted QuickBooks token')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
