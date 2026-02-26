import { randomBytes } from 'crypto'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
const CODE_LENGTH = 6
const DEFAULT_EXPIRY_HOURS = 24 * 7 // 7 days

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length]
  }
  return code
}

/**
 * Create a short link for a URL. Used for SMS to keep messages in 1 segment.
 * @param url - Full destination URL
 * @param expiresInHours - Hours until link expires (default 7 days)
 * @returns Short URL (e.g. https://app.jobdock.dev/s/Abc12X)
 */
export async function createShortLink(
  url: string,
  expiresInHours: number = DEFAULT_EXPIRY_HOURS
): Promise<string> {
  const { default: prisma } = await import('./db')

  let code: string
  let attempts = 0
  const maxAttempts = 5

  do {
    code = generateCode()
    const existing = await prisma.shortLink.findUnique({ where: { code } })
    if (!existing) break
    attempts++
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique short link code')
    }
  } while (true)

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

  await prisma.shortLink.create({
    data: {
      id: crypto.randomUUID(),
      code,
      url,
      expiresAt,
    },
  })

  const baseUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  return `${baseUrl}/s/${code}`
}

/**
 * Resolve a short link code to the full URL. Returns null if not found or expired.
 */
export async function resolveShortLink(code: string): Promise<string | null> {
  const { default: prisma } = await import('./db')

  const link = await prisma.shortLink.findUnique({
    where: { code: code.trim() },
  })

  if (!link) return null
  if (link.expiresAt < new Date()) return null

  return link.url
}
