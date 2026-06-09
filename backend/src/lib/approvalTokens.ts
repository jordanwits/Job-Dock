import { createHmac } from 'crypto'

/**
 * Resolve the HMAC signing secret for approval tokens.
 *
 * There is intentionally NO insecure fallback: these tokens are the entire security
 * boundary for the public (unauthenticated) quote/invoice/job approval flow, so a
 * guessable default would let anyone forge a valid token for any tenant's resource.
 * We fail closed if the secret is not configured.
 */
function getApprovalSecret(): string {
  const secret = process.env.APPROVAL_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'APPROVAL_SECRET is not configured. Set APPROVAL_SECRET in the Lambda environment.'
    )
  }
  return secret
}

/**
 * Generate a secure approval token for quote/invoice/job approval links
 * The token is an HMAC of the resource type, ID, and tenant ID
 */
export function generateApprovalToken(
  resource: 'quote' | 'invoice' | 'job',
  id: string,
  tenantId: string
): string {
  const secret = getApprovalSecret()

  const message = `${resource}:${id}:${tenantId}`
  const hmac = createHmac('sha256', secret)
  hmac.update(message)
  return hmac.digest('hex')
}

/**
 * Verify an approval token matches the expected value
 */
export function verifyApprovalToken(
  resource: 'quote' | 'invoice' | 'job',
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
