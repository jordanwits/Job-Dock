/**
 * Authentication Helpers
 * 
 * AWS Cognito integration and JWT token handling
 */

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const USER_POOL_ID = process.env.USER_POOL_ID!
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID!

export interface CognitoUser {
  sub: string
  email: string
  email_verified: boolean
  'cognito:username': string
}

/**
 * Get user from Cognito
 */
export async function getCognitoUser(username: string): Promise<CognitoUser> {
  const command = new AdminGetUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  })

  const response = await cognitoClient.send(command)

  if (!response.Username) {
    throw new Error('User not found')
  }

  // Extract attributes
  const attributes = response.UserAttributes || []
  const user: Partial<CognitoUser> = {
    sub: response.UserAttributes?.find(a => a.Name === 'sub')?.Value || '',
    email: response.UserAttributes?.find(a => a.Name === 'email')?.Value || '',
    email_verified: response.UserAttributes?.find(a => a.Name === 'email_verified')?.Value === 'true',
    'cognito:username': response.Username,
  }

  return user as CognitoUser
}

/**
 * Register new user in Cognito
 */
export async function registerUser(email: string, password: string, name: string) {
  const command = new SignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: name },
    ],
  })

  const response = await cognitoClient.send(command)
  return response
}

/**
 * Login user
 */
export async function loginUser(email: string, password: string) {
  const command = new InitiateAuthCommand({
    ClientId: CLIENT_ID,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  })

  const response = await cognitoClient.send(command)

  if (response.ChallengeName) {
    // Handle challenge (e.g., NEW_PASSWORD_REQUIRED)
    throw new Error(`Challenge required: ${response.ChallengeName}`)
  }

  return {
    AccessToken: response.AuthenticationResult?.AccessToken,
    IdToken: response.AuthenticationResult?.IdToken,
    RefreshToken: response.AuthenticationResult?.RefreshToken,
  }
}

/**
 * Verify JWT token from Authorization header
 */
export async function verifyToken(token: string): Promise<CognitoUser> {
  // Extract username from token (simplified - in production, use jwt.decode or jwks)
  // For now, we'll get user from Cognito using the token
  // In production, decode JWT and verify signature
  
  // This is a placeholder - implement proper JWT verification
  // You can use aws-jwt-verify library for production
  throw new Error('Token verification not implemented - use aws-jwt-verify')
}

/**
 * Extract tenant ID from token or user
 */
export async function getTenantIdFromToken(token: string): Promise<string> {
  // Extract tenant_id from JWT token claims
  // This should be set during user registration
  // For now, return a placeholder
  const user = await verifyToken(token)
  // In production, tenant_id should be in token claims
  return 'tenant-placeholder' // Replace with actual tenant extraction
}

