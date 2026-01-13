/**
 * Authentication Lambda Handler
 * 
 * Handles: register, login, refresh, logout
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { CognitoIdentityProviderClient, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider'
import { registerUser, loginUser, refreshAccessToken, verifyToken } from '../../lib/auth'
import { successResponse, errorResponse, corsResponse } from '../../lib/middleware'
import prisma from '../../lib/db'
import { randomUUID } from 'crypto'

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
})
const USER_POOL_ID = process.env.USER_POOL_ID!

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

  try {
    // 1. Register user in Cognito
    const cognitoResponse = await registerUser(email, password, name)
    const cognitoId = cognitoResponse.UserSub!

    // 1.5. Auto-confirm the user so they can log in immediately
    // This bypasses the email verification step for a better UX
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    )

    // 2. Create tenant and user in database
    const tenantId = randomUUID()
    const tenantName = companyName || `${name}'s Company`
    const subdomain = slugify(tenantName)
    
    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantName,
        subdomain: subdomain,
      },
    })

    // Create user linked to tenant
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        cognitoId: cognitoId,
        email: email,
        name: name,
        tenantId: tenant.id,
        role: 'owner',
      },
    })

    // 3. Automatically log the user in
    const tokens = await loginUser(email, password)

    // 4. Return token and user info
    // Use IdToken (not AccessToken) because it contains user claims like email, sub, etc
    return successResponse({
      token: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
      },
    }, 201)
  } catch (error: any) {
    console.error('Registration error:', error)
    return errorResponse(error.message || 'Registration failed', 500)
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

async function handleLogin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { email, password } = body

  if (!email || !password) {
    return errorResponse('Email and password required', 400)
  }

  try {
    // 1. Authenticate with Cognito
    const tokens = await loginUser(email, password)

    // 2. Decode the ID token to get Cognito user ID
    // The token is a JWT, we can use our verifyToken function
    const { verifyToken } = await import('../../lib/auth')
    const cognitoUser = await verifyToken(tokens.IdToken!)

    // 3. Look up user in database by Cognito ID
    const user = await prisma.user.findUnique({
      where: { cognitoId: cognitoUser.sub },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
      },
    })

    if (!user) {
      return errorResponse(
        'User is not provisioned in JobDock. Please contact support.',
        404
      )
    }

    // 4. Return tokens and user info including tenantId
    // Use IdToken (not AccessToken) because it contains user claims like email, sub, etc
    return successResponse({
      token: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return errorResponse(error.message || 'Login failed', 500)
  }
}

async function handleRefresh(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { refreshToken } = body

  if (!refreshToken) {
    return errorResponse('Refresh token required', 400)
  }

  try {
    // 1. Use the refresh token to get new access and ID tokens from Cognito
    const tokens = await refreshAccessToken(refreshToken)

    // 2. Decode the new ID token to get user info
    const cognitoUser = await verifyToken(tokens.IdToken!)

    // 3. Look up user in database by Cognito ID
    const user = await prisma.user.findUnique({
      where: { cognitoId: cognitoUser.sub },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
      },
    })

    if (!user) {
      return errorResponse(
        'User not found in JobDock database',
        404
      )
    }

    // 4. Return new tokens and user info
    return successResponse({
      token: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
      },
    })
  } catch (error: any) {
    console.error('Token refresh error:', error)
    return errorResponse(error.message || 'Token refresh failed', 401)
  }
}

async function handleLogout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // TODO: Implement logout (revoke tokens)
  return successResponse({ message: 'Logged out successfully' })
}

