/**
 * Lambda Middleware
 *
 * Request/response middleware for Lambda functions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { verifyToken, getTenantIdFromToken } from './auth'

export interface LambdaContext {
  tenantId: string
  userId: string
  userEmail: string
}

// --- CORS origin allowlist ---
// `Access-Control-Allow-Origin` can only name a single origin, so we resolve the request's
// Origin against an allowlist per-invocation instead of returning a blanket '*'. Add extra
// origins via the CORS_ALLOWED_ORIGINS env var (comma-separated).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://thejobdock.com',
  'https://www.thejobdock.com',
  'https://app.thejobdock.com',
]
const ALLOWED_ORIGINS = [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
]
const PRIMARY_ORIGIN = ALLOWED_ORIGINS[0]!

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const host = new URL(origin).hostname
    if (host.endsWith('.vercel.app')) return true // Vercel preview/prod deployments
    if (host === 'localhost' || host === '127.0.0.1') return true // local dev
  } catch {
    /* not a valid origin URL */
  }
  return false
}

// Set once at the top of each Lambda handler. Lambda runs a single request at a time per
// execution environment, so a module-level value is safe (invocations never interleave).
// Unknown origins fall back to the primary app origin, which the browser will reject as a
// mismatch — denying the cross-origin read without breaking the app's own same-origin calls.
let activeCorsOrigin = PRIMARY_ORIGIN

export function setRequestOrigin(event: APIGatewayProxyEvent): void {
  const origin = event.headers?.origin || event.headers?.Origin || ''
  activeCorsOrigin = origin && isAllowedOrigin(origin) ? origin : PRIMARY_ORIGIN
}

/**
 * Extract tenant ID from request
 * Priority: JWT token (if authenticated) > X-Tenant-ID header (for public/unauthenticated) > error
 */
export async function extractTenantId(event: APIGatewayProxyEvent): Promise<string> {
  const headers = event.headers ?? {}

  // If Authorization header is present, ALWAYS resolve via JWT token
  // This prevents authenticated users from tampering with X-Tenant-ID
  const authHeader = headers.Authorization || headers.authorization
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    return await getTenantIdFromToken(token)
  }

  // For unauthenticated requests (public booking, webhooks, etc.),
  // allow X-Tenant-ID header
  const tenantIdHeader = headers['x-tenant-id'] || headers['X-Tenant-ID']
  if (tenantIdHeader) {
    return tenantIdHeader
  }

  throw new Error('Tenant ID not found in request')
}

/**
 * Extract user context from request
 */
export async function extractContext(event: APIGatewayProxyEvent): Promise<LambdaContext> {
  const headers = event.headers ?? {}
  const authHeader = headers.Authorization || headers.authorization
  if (!authHeader) {
    const { ApiError } = await import('./errors')
    throw new ApiError('Authorization header required', 401)
  }

  const token = authHeader.replace('Bearer ', '')
  const tenantId = await extractTenantId(event)

  // Verify token and extract user info
  const user = await verifyToken(token)

  return {
    tenantId,
    userId: user.sub,
    userEmail: user.email,
  }
}

/**
 * Create success response
 */
export function successResponse(data: any, statusCode: number = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': activeCorsOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      // Prevent browsers/CDNs from caching API responses (important for fresh photo lists)
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: JSON.stringify(data),
  }
}

/**
 * Create binary response (e.g. for images)
 */
export function binaryResponse(
  body: Buffer,
  contentType: string,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': activeCorsOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      // Avoid caching signed/tokenized photo URLs
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: body.toString('base64'),
    isBase64Encoded: true,
  }
}

/**
 * Create error response
 */
export function errorResponse(
  error: Error | string,
  statusCode: number = 500
): APIGatewayProxyResult {
  const message = error instanceof Error ? error.message : error
  const errorData: any = {
    message,
    statusCode,
  }

  // Include additional error properties like conflicts
  if (error instanceof Error && 'conflicts' in error) {
    errorData.conflicts = (error as any).conflicts
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': activeCorsOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: JSON.stringify({
      error: errorData,
    }),
  }
}

/**
 * Handle CORS preflight
 */
export function corsResponse(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': activeCorsOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: '',
  }
}
