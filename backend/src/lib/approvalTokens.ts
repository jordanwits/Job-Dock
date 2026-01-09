import { createHmac } from 'crypto'

/**
 * Generate a secure approval token for quote/invoice approval links
 * The token is an HMAC of the resource type, ID, and tenant ID
 */
export function generateApprovalToken(
  resource: 'quote' | 'invoice',
  id: string,
  tenantId: string
): string {
  const secret = process.env.APPROVAL_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production'
  
  if (!process.env.APPROVAL_SECRET && !process.env.JWT_SECRET) {
    console.warn('⚠️  APPROVAL_SECRET not set, using fallback secret. Set APPROVAL_SECRET in production!')
  }
  
  const message = `${resource}:${id}:${tenantId}`
  const hmac = createHmac('sha256', secret)
  hmac.update(message)
  return hmac.digest('hex')
}

/**
 * Verify an approval token matches the expected value
 */
export function verifyApprovalToken(
  resource: 'quote' | 'invoice',
  id: string,
  tenantId: string,
  token: string
): boolean {
  const expectedToken = generateApprovalToken(resource, id, tenantId)
  
  // Use constant-time comparison to prevent timing attacks
  if (token.length !== expectedToken.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i)
  }
  
  return result === 0
}
