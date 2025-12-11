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
 * Priority: X-Tenant-ID header > JWT token > error
 */
export async function extractTenantId(
  event: APIGatewayProxyEvent
): Promise<string> {
  // Check header first
  const tenantIdHeader = event.headers['x-tenant-id'] || event.headers['X-Tenant-ID']
  if (tenantIdHeader) {
    return tenantIdHeader
  }

  // Extract from JWT token
  const authHeader = event.headers.Authorization || event.headers.authorization
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    return await getTenantIdFromToken(token)
  }

  throw new Error('Tenant ID not found in request')
}

/**
 * Extract user context from request
 */
export async function extractContext(
  event: APIGatewayProxyEvent
): Promise<LambdaContext> {
  const authHeader = event.headers.Authorization || event.headers.authorization
  if (!authHeader) {
    throw new Error('Authorization header required')
  }

  const token = authHeader.replace('Bearer ', '')
  const tenantId = await extractTenantId(event)

  // Verify token and extract user info
  // This is simplified - implement proper JWT verification
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
export function successResponse(
  data: any,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Configure properly in production
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(data),
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

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      error: {
        message,
        statusCode,
      },
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
    },
    body: '',
  }
}

