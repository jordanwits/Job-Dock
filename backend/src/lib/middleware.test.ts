import type { APIGatewayProxyEvent } from 'aws-lambda'

const mockVerifyToken = jest.fn()
const mockGetTenantIdFromToken = jest.fn()

jest.mock('./auth', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  getTenantIdFromToken: (...args: unknown[]) => mockGetTenantIdFromToken(...args),
}))

import { extractTenantId, extractContext } from './middleware'
import { ApiError } from './errors'

function makeEvent(headers: Record<string, string>): APIGatewayProxyEvent {
  return { headers } as unknown as APIGatewayProxyEvent
}

const JWT_TENANT = 'tenant-from-jwt'
const ATTACKER_TENANT = 'victim-tenant-uuid'

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTenantIdFromToken.mockResolvedValue(JWT_TENANT)
  mockVerifyToken.mockResolvedValue({
    sub: 'cognito-sub-1',
    email: 'owner@example.com',
    email_verified: true,
    'cognito:username': 'owner@example.com',
  })
})

describe('extractTenantId', () => {
  it('resolves the tenant from the JWT', async () => {
    await expect(extractTenantId(makeEvent({ Authorization: 'Bearer good-token' }))).resolves.toBe(
      JWT_TENANT
    )
    expect(mockGetTenantIdFromToken).toHaveBeenCalledWith('good-token')
  })

  it('accepts a lowercase authorization header', async () => {
    await expect(extractTenantId(makeEvent({ authorization: 'Bearer good-token' }))).resolves.toBe(
      JWT_TENANT
    )
  })

  // The auth-bypass regression: an X-Tenant-ID header is not a credential.
  it('rejects an X-Tenant-ID header with no Authorization header', async () => {
    const event = makeEvent({ 'x-tenant-id': ATTACKER_TENANT })
    await expect(extractTenantId(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(mockGetTenantIdFromToken).not.toHaveBeenCalled()
  })

  it('rejects the capitalized X-Tenant-ID header variant too', async () => {
    const event = makeEvent({ 'X-Tenant-ID': ATTACKER_TENANT })
    await expect(extractTenantId(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects a request with no headers at all', async () => {
    await expect(extractTenantId({} as APIGatewayProxyEvent)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('ignores X-Tenant-ID when a JWT is present (no tenant tampering)', async () => {
    const event = makeEvent({
      Authorization: 'Bearer good-token',
      'x-tenant-id': ATTACKER_TENANT,
    })
    await expect(extractTenantId(event)).resolves.toBe(JWT_TENANT)
  })
})

describe('extractContext', () => {
  it('returns tenant and user identity for a valid token', async () => {
    const context = await extractContext(makeEvent({ Authorization: 'Bearer good-token' }))
    expect(context).toEqual({
      tenantId: JWT_TENANT,
      userId: 'cognito-sub-1',
      userEmail: 'owner@example.com',
    })
  })

  it('throws 401 when the Authorization header is missing', async () => {
    await expect(extractContext(makeEvent({ 'x-tenant-id': ATTACKER_TENANT }))).rejects.toMatchObject(
      { statusCode: 401 }
    )
  })

  // A bogus bearer token must surface as 401, not an unhandled 500.
  it('propagates a token-verification failure as ApiError 401', async () => {
    mockGetTenantIdFromToken.mockRejectedValue(new ApiError('Invalid or expired token', 401))
    const promise = extractContext(makeEvent({ Authorization: 'Bearer bogus' }))
    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ statusCode: 401 })
  })

  it('propagates an unknown-user failure as ApiError 401', async () => {
    mockGetTenantIdFromToken.mockRejectedValue(
      new ApiError('User not found in CleanDock database', 401)
    )
    await expect(extractContext(makeEvent({ Authorization: 'Bearer good-token' }))).rejects.toMatchObject(
      { statusCode: 401 }
    )
  })
})
