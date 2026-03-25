/**
 * Authentication Lambda Handler
 *
 * Handles: register, login, refresh, logout
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
  CognitoIdentityProviderClient,
  AdminConfirmSignUpCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  verifyToken,
  respondToNewPasswordChallenge,
  type CognitoUser,
} from '../../lib/auth'
import { successResponse, errorResponse, corsResponse } from '../../lib/middleware'
import prisma from '../../lib/db'
import { dataServices } from '../../lib/dataService'
import { randomUUID } from 'crypto'

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
})
const USER_POOL_ID = process.env.USER_POOL_ID!

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
      case 'POST /auth/signup-checkout':
        return await handleSignupCheckout(event)
      case 'GET /auth/signup-session':
        return await handleSignupSession(event)
      case 'POST /auth/complete-signup':
        return await handleCompleteSignup(event)
      case 'POST /auth/login':
        return await handleLogin(event)
      case 'POST /auth/respond-to-challenge':
        return await handleRespondToChallenge(event)
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

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { email, password, name, companyName, plan } = body

  if (!email || !password || !name) {
    return errorResponse('Missing required fields', 400)
  }

  const validPlans = ['single', 'team', 'team-plus'] as const
  if (!plan || !validPlans.includes(plan)) {
    return errorResponse('Please select a plan to sign up. Choose Single, Team, or Team+.', 400)
  }

  try {
    // 1. Register user in Cognito
    const cognitoResponse = await registerUser(email, password, name)
    const cognitoId = cognitoResponse.UserSub!

    // 1.5. Auto-confirm the user so they can log in immediately
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    )

    // 2. Create tenant and user in database
    const tenantId = randomUUID()
    const tenantName = companyName || `${name}'s Company`
    const baseSubdomain = slugify(tenantName)
    const uniqueId = tenantId.substring(0, 8)
    const subdomain = `${baseSubdomain}-${uniqueId}`

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantName,
        subdomain: subdomain,
      },
    })

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

    // 3. Create Stripe checkout session and return checkout URL (subscription required)
    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
    const { url: checkoutUrl } = await dataServices.billing.createCheckoutRedirectUrl(
      tenant.id,
      user.id,
      user.email,
      {
        plan,
        successUrl: `${appUrl}/auth/login?from_checkout=1`,
        cancelUrl: `${appUrl}/auth/signup?canceled=1`,
      }
    )

    if (!checkoutUrl) {
      throw new Error('Failed to create checkout session')
    }

    return successResponse({ checkoutUrl }, 201)
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

const appUserSelect = {
  id: true,
  email: true,
  name: true,
  tenantId: true,
  role: true,
  canCreateJobs: true,
  canScheduleAppointments: true,
  canSeeOtherJobs: true,
  canSeeJobPrices: true,
  onboardingCompletedAt: true,
} as const

type AppUserRow = {
  id: string
  email: string
  name: string
  tenantId: string
  role: string
  canCreateJobs: boolean
  canScheduleAppointments: boolean
  canSeeOtherJobs: boolean
  canSeeJobPrices: boolean
  onboardingCompletedAt: Date | null
}

/**
 * Look up JobDock user by Cognito sub, or create tenant + owner (Cognito-only users).
 * Used after normal login and after NEW_PASSWORD_REQUIRED challenge.
 */
async function findOrProvisionUserFromCognito(cognitoUser: CognitoUser): Promise<AppUserRow | null> {
  const existing = await prisma.user.findUnique({
    where: { cognitoId: cognitoUser.sub },
    select: appUserSelect,
  })
  if (existing) return existing

  console.log('[Auth] User not in database, auto-provisioning from Cognito...')
  try {
    const poolUsername =
      typeof cognitoUser['cognito:username'] === 'string' && cognitoUser['cognito:username'].trim()
        ? cognitoUser['cognito:username'].trim()
        : cognitoUser.email

    const cognitoUserDetails = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: poolUsername,
      })
    )

    const nameAttr = cognitoUserDetails.UserAttributes?.find(a => a.Name === 'name')
    const userName = nameAttr?.Value || cognitoUser.email.split('@')[0] || 'User'

    const tenantId = randomUUID()
    const tenantName = `${userName}'s Company`
    const baseSubdomain = slugify(tenantName)
    const uniqueId = tenantId.substring(0, 8)
    const subdomain = `${baseSubdomain}-${uniqueId}`

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantName,
        subdomain: subdomain,
      },
    })

    const created = await prisma.user.create({
      data: {
        id: randomUUID(),
        cognitoId: cognitoUser.sub,
        email: cognitoUser.email,
        name: userName,
        tenantId: tenant.id,
        role: 'owner',
      },
      select: appUserSelect,
    })

    console.log(`[Auth] Auto-provisioned owner: ${created.email}`)
    return created
  } catch (provisionError: unknown) {
    console.error('[Auth] Auto-provisioning failed:', provisionError)
    return null
  }
}

/** Stripe-first signup: create checkout session, user pays, then creates account. */
async function handleSignupCheckout(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { plan } = body
  const validPlans = ['single', 'team', 'team-plus'] as const
  if (!plan || !validPlans.includes(plan)) {
    return errorResponse('Please select a plan. Choose Single, Team, or Team+.', 400)
  }
  try {
    const { url: checkoutUrl } = await dataServices.billing.createSignupCheckoutSession(plan)
    if (!checkoutUrl) throw new Error('Failed to create checkout session')
    return successResponse({ checkoutUrl }, 200)
  } catch (error: any) {
    console.error('Signup checkout error:', error)
    return errorResponse(error.message || 'Failed to start checkout', 500)
  }
}

/** Get email and plan from completed Stripe session (for create-account form). */
async function handleSignupSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = event.queryStringParameters?.session_id
  if (!sessionId) {
    return errorResponse('session_id required', 400)
  }
  try {
    const info = await dataServices.billing.getSignupSessionInfo(sessionId)
    return successResponse({ email: info.email, plan: info.plan })
  } catch (error: any) {
    console.error('Signup session error:', error)
    return errorResponse(error.message || 'Invalid or expired session', 400)
  }
}

/** Complete signup after Stripe: create account and link subscription. */
async function handleCompleteSignup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { session_id: sessionId, name, companyName, password } = body
  if (!sessionId || !name || !password) {
    return errorResponse('Missing required fields', 400)
  }
  try {
    const info = await dataServices.billing.getSignupSessionInfo(sessionId)
    const email = info.email
    const plan = info.plan
    const priceId =
      plan === 'team-plus'
        ? process.env.STRIPE_TEAM_PLUS_PRICE_ID
        : plan === 'team'
          ? process.env.STRIPE_TEAM_PRICE_ID
          : process.env.STRIPE_PRICE_ID

    const cognitoResponse = await registerUser(email, password, name)
    const cognitoId = cognitoResponse.UserSub!

    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    )

    const tenantId = randomUUID()
    const tenantName = companyName || `${name}'s Company`
    const baseSubdomain = slugify(tenantName)
    const uniqueId = tenantId.substring(0, 8)
    const subdomain = `${baseSubdomain}-${uniqueId}`

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantName,
        subdomain,
        stripeCustomerId: info.customerId,
        stripeSubscriptionId: info.subscriptionId,
        stripePriceId: priceId || undefined,
        stripeSubscriptionStatus: 'active',
        subscriptionTier: plan,
      },
    })

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        cognitoId,
        email,
        name,
        tenantId,
        role: 'owner',
      },
    })

    const tokens = await loginUser(email, password)
    return successResponse(
      {
        token: tokens.IdToken,
        refreshToken: tokens.RefreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
          onboardingCompletedAt: null,
        },
      },
      201
    )
  } catch (error: any) {
    console.error('Complete signup error:', error)
    return errorResponse(error.message || 'Failed to complete signup', 500)
  }
}

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now()
  const body = JSON.parse(event.body || '{}')
  const { email, password } = body

  if (!email || !password) {
    return errorResponse('Email and password required', 400)
  }

  try {
    console.log(`[Login] Starting login for: ${email}`)

    // 1. Authenticate with Cognito
    const cognitoStart = Date.now()
    console.log(`[Login] Step 1: Authenticating with Cognito...`)
    const authResult = await loginUser(email, password)
    console.log(`[Login] Step 1 complete: Cognito auth took ${Date.now() - cognitoStart}ms`)

    if ('challengeRequired' in authResult && authResult.challengeRequired === 'NEW_PASSWORD_REQUIRED') {
      return successResponse({
        challengeRequired: 'NEW_PASSWORD_REQUIRED',
        session: authResult.session,
        email,
      })
    }

    const tokens = authResult

    // 2. Decode the ID token to get Cognito user ID
    const verifyStart = Date.now()
    console.log(`[Login] Step 2: Verifying token...`)
    const cognitoUser = await verifyToken(tokens.IdToken!)
    console.log(`[Login] Step 2 complete: Token verification took ${Date.now() - verifyStart}ms`)

    // 3. Look up or auto-provision JobDock user (same as after NEW_PASSWORD_REQUIRED)
    const dbStart = Date.now()
    console.log(`[Login] Step 3: Looking up / provisioning user...`)
    const user = await findOrProvisionUserFromCognito(cognitoUser)
    console.log(`[Login] Step 3 complete: Database step took ${Date.now() - dbStart}ms`)

    if (!user) {
      return errorResponse(
        'User is not provisioned in JobDock. Please contact support or try registering again.',
        404
      )
    }

    const totalTime = Date.now() - startTime
    console.log(`[Login] Success! Total time: ${totalTime}ms`)

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
        role: user.role || 'admin',
        canCreateJobs: user.canCreateJobs ?? true,
        canScheduleAppointments: user.canScheduleAppointments ?? true,
        canSeeOtherJobs: user.canSeeOtherJobs ?? false,
        canSeeJobPrices: user.canSeeJobPrices ?? true,
        onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      },
    })
  } catch (error: any) {
    const totalTime = Date.now() - startTime
    console.error(`[Login] Error after ${totalTime}ms:`, error)

    // Cognito auth failures should not be treated as 500s.
    // The AWS SDK typically throws errors with `name` like "NotAuthorizedException".
    const errorName: string | undefined =
      typeof error?.name === 'string'
        ? error.name
        : typeof error?.__type === 'string'
          ? error.__type
          : undefined

    if (errorName === 'NotAuthorizedException') {
      return errorResponse('Incorrect email or password', 401)
    }
    if (errorName === 'UserNotFoundException') {
      return errorResponse('Incorrect email or password', 401)
    }
    if (errorName === 'PasswordResetRequiredException') {
      return errorResponse(
        'Password reset required. Please reset your password and try again.',
        403
      )
    }
    if (errorName === 'UserNotConfirmedException') {
      return errorResponse(
        'User is not confirmed. Please check your email for a confirmation link.',
        403
      )
    }

    return errorResponse(error?.message || 'Login failed', 500)
  }
}

async function handleRespondToChallenge(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { session, email, newPassword } = body

  if (!session || !email || !newPassword) {
    return errorResponse('Session, email, and new password are required', 400)
  }

  try {
    const tokens = await respondToNewPasswordChallenge(session, email, newPassword)
    const cognitoUser = await verifyToken(tokens.IdToken!)

    const user = await findOrProvisionUserFromCognito(cognitoUser)
    if (!user) {
      return errorResponse(
        'User is not provisioned in JobDock. Please contact support or try registering again.',
        404
      )
    }

    return successResponse({
      token: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role || 'admin',
        canCreateJobs: user.canCreateJobs ?? true,
        canScheduleAppointments: user.canScheduleAppointments ?? true,
        canSeeOtherJobs: user.canSeeOtherJobs ?? false,
        canSeeJobPrices: user.canSeeJobPrices ?? true,
        onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      },
    })
  } catch (error: any) {
    console.error('Respond to challenge error:', error)
    const errorName = typeof error?.name === 'string' ? error.name : undefined
    if (errorName === 'InvalidPasswordException') {
      return errorResponse(
        'Password does not meet requirements. Must be at least 12 characters with uppercase, lowercase, number, and special character (!@#$%^&*).',
        400
      )
    }
    return errorResponse(error?.message || 'Failed to set new password', 500)
  }
}

async function handleRefresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
        role: true,
        canCreateJobs: true,
        canScheduleAppointments: true,
        canSeeOtherJobs: true,
        canSeeJobPrices: true,
        onboardingCompletedAt: true,
      },
    })

    if (!user) {
      return errorResponse('User not found in JobDock database', 404)
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
        role: user.role || 'admin',
        canCreateJobs: user.canCreateJobs ?? true,
        canScheduleAppointments: user.canScheduleAppointments ?? true,
        canSeeOtherJobs: user.canSeeOtherJobs ?? false,
        canSeeJobPrices: user.canSeeJobPrices ?? true,
        onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      },
    })
  } catch (error: any) {
    console.error('Token refresh error:', error)
    return errorResponse(error.message || 'Token refresh failed', 401)
  }
}

async function handleLogout(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // TODO: Implement logout (revoke tokens)
  return successResponse({ message: 'Logged out successfully' })
}
