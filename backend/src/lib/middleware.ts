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
      'Access-Control-Allow-Origin': '*', // Configure properly in production
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
      'Access-Control-Allow-Origin': '*',
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
      'Access-Control-Allow-Origin': '*',
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: '',
  }
}
