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
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import prisma from './db'

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const USER_POOL_ID = process.env.USER_POOL_ID!
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID!

// JWT Verifier for ID tokens
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID,
})

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
  try {
    // Verify the JWT token using aws-jwt-verify
    const payload = await jwtVerifier.verify(token)
    
    // Extract user information from the verified JWT payload
    const email = typeof payload.email === 'string' ? payload.email : ''
    const emailVerified = payload.email_verified === true
    const username = typeof payload['cognito:username'] === 'string' 
      ? payload['cognito:username'] 
      : payload.sub
    
    return {
      sub: payload.sub,
      email: email,
      email_verified: emailVerified,
      'cognito:username': username,
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    throw new Error('Invalid or expired token')
  }
}

/**
 * Extract tenant ID from token or user
 */
export async function getTenantIdFromToken(token: string): Promise<string> {
  // Verify the token and extract the Cognito user ID (sub)
  const cognitoUser = await verifyToken(token)
  
  // Look up the application user by their Cognito ID
  const user = await prisma.user.findUnique({
    where: { cognitoId: cognitoUser.sub },
    select: { tenantId: true },
  })
  
  if (!user) {
    throw new Error('User not found in JobDock database')
  }
  
  return user.tenantId
}

