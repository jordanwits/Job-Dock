/**
 * JWT Token Utility Functions
 * 
 * Utilities for checking JWT token validity and expiration
 */

interface JWTPayload {
  exp?: number
  iat?: number
  userId?: string
  tenantId?: string
  email?: string
  [key: string]: any
}

/**
 * Decode a JWT token without verification
 * Note: This does NOT verify the signature, only decodes the payload
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode the payload (base64url)
    const payload = parts[1]
    const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodedPayload)
  } catch (error) {
    console.error('Failed to decode JWT:', error)
    return null
  }
}

/**
 * Check if a JWT token is expired
 * @param token - The JWT token to check
 * @param bufferSeconds - Number of seconds before actual expiry to consider token expired (default: 60)
 * @returns true if token is expired or invalid, false otherwise
 */
export function isTokenExpired(token: string | null, bufferSeconds: number = 60): boolean {
  if (!token) {
    return true
  }

  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    return true
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000
  const currentTime = Date.now()
  const bufferTime = bufferSeconds * 1000

  return currentTime >= (expirationTime - bufferTime)
}

/**
 * Get the expiration time of a JWT token
 * @param token - The JWT token
 * @returns Date object of expiration time, or null if invalid
 */
export function getTokenExpiration(token: string | null): Date | null {
  if (!token) {
    return null
  }

  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    return null
  }

  return new Date(payload.exp * 1000)
}

/**
 * Get time remaining until token expiration in seconds
 * @param token - The JWT token
 * @returns Seconds until expiration, or 0 if expired/invalid
 */
export function getTokenTimeRemaining(token: string | null): number {
  if (!token) {
    return 0
  }

  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    return 0
  }

  const expirationTime = payload.exp * 1000
  const currentTime = Date.now()
  const remaining = Math.floor((expirationTime - currentTime) / 1000)

  return Math.max(0, remaining)
}

/**
 * Check if token is valid and not expired
 * @param token - The JWT token to validate
 * @returns true if token appears valid and not expired
 */
export function isTokenValid(token: string | null): boolean {
  return !isTokenExpired(token)
}
