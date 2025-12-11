/**
 * Authentication Lambda Handler
 * 
 * Handles: register, login, refresh, logout
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { registerUser, loginUser } from '../../lib/auth'
import { successResponse, errorResponse, corsResponse } from '../../lib/middleware'

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse()
  }

  try {
    const route = buildRouteKey(event)

    switch (route) {
      case 'GET /health':
        return successResponse({ status: 'ok' })
      case 'POST /auth/register':
        return await handleRegister(event)
      case 'POST /auth/login':
        return await handleLogin(event)
      case 'POST /auth/refresh':
        return await handleRefresh(event)
      case 'POST /auth/logout':
        return await handleLogout(event)
      default:
        return errorResponse('Route not found', 404)
    }
  } catch (error) {
    console.error('Auth handler error:', error)
    return errorResponse(error instanceof Error ? error : 'Internal server error', 500)
  }
}

function buildRouteKey(event: APIGatewayProxyEvent): string {
  const { httpMethod, resource, path, requestContext } = event

  if (resource) {
    return `${httpMethod} ${resource}`
  }

  const stage = requestContext?.stage
  let normalizedPath = path || '/'

  if (stage && normalizedPath.startsWith(`/${stage}`)) {
    normalizedPath = normalizedPath.slice(stage.length + 1)
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`
    }
    if (!normalizedPath) {
      normalizedPath = '/'
    }
  }

  return `${httpMethod} ${normalizedPath}`
}

async function handleRegister(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { email, password, name, companyName } = body

  if (!email || !password || !name) {
    return errorResponse('Missing required fields', 400)
  }

  // Register user in Cognito
  const cognitoResponse = await registerUser(email, password, name)

  // TODO: Create user record in database with tenant
  // This requires creating a tenant first, then user

  return successResponse({
    message: 'User registered successfully',
    userId: cognitoResponse.UserSub,
  }, 201)
}

async function handleLogin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { email, password } = body

  if (!email || !password) {
    return errorResponse('Email and password required', 400)
  }

  const tokens = await loginUser(email, password)

  // TODO: Get user and tenant info from database

  return successResponse({
    token: tokens.AccessToken,
    refreshToken: tokens.RefreshToken,
    user: {
      email,
      // Add user and tenant info from database
    },
  })
}

async function handleRefresh(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // TODO: Implement token refresh
  return errorResponse('Not implemented', 501)
}

async function handleLogout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // TODO: Implement logout (revoke tokens)
  return successResponse({ message: 'Logged out successfully' })
}

