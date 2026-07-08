import { signState, verifyState, parseIdTokenEmail, type OAuthStatePayload } from './oauth'

const SECRET = 'test-google-client-secret-abc123'

beforeAll(() => {
  // verifyState reads the secret out of the env (via loadGoogleCalendarConfig); signState takes it
  // explicitly. Keep them the same so a well-formed state verifies.
  process.env.GOOGLE_CLIENT_SECRET = SECRET
})

describe('oauth state sign/verify', () => {
  const payload: OAuthStatePayload = { t: 'tenant-1', u: 'user-1', m: 'mine', n: 'nonce-xyz' }

  test('round-trips a valid state and returns the decoded payload', () => {
    const state = signState(payload, SECRET)
    const decoded = verifyState(state, { tenantId: 'tenant-1', userId: 'user-1' })
    expect(decoded).not.toBeNull()
    expect(decoded).toMatchObject({ t: 'tenant-1', u: 'user-1', m: 'mine' })
  })

  test('rejects a tampered payload segment', () => {
    const state = signState(payload, SECRET)
    const [encoded, sig] = state.split('.')
    // Flip the last character of the payload segment — signature no longer matches.
    const tamperedEncoded = encoded.slice(0, -1) + (encoded.endsWith('A') ? 'B' : 'A')
    const tampered = `${tamperedEncoded}.${sig}`
    expect(verifyState(tampered, { tenantId: 'tenant-1', userId: 'user-1' })).toBeNull()
  })

  test('rejects a tampered signature', () => {
    const state = signState(payload, SECRET)
    const [encoded] = state.split('.')
    expect(verifyState(`${encoded}.deadbeef`, { tenantId: 'tenant-1', userId: 'user-1' })).toBeNull()
  })

  test('rejects a state minted for a different tenant/user', () => {
    const state = signState(payload, SECRET)
    expect(verifyState(state, { tenantId: 'other-tenant', userId: 'user-1' })).toBeNull()
    expect(verifyState(state, { tenantId: 'tenant-1', userId: 'other-user' })).toBeNull()
  })

  test('rejects a state signed with a different secret', () => {
    const state = signState(payload, 'a-different-secret')
    expect(verifyState(state, { tenantId: 'tenant-1', userId: 'user-1' })).toBeNull()
  })

  test('rejects malformed state', () => {
    expect(verifyState('', { tenantId: 'tenant-1', userId: 'user-1' })).toBeNull()
    expect(verifyState('no-dot-here', { tenantId: 'tenant-1', userId: 'user-1' })).toBeNull()
  })
})

describe('parseIdTokenEmail', () => {
  test('extracts the email claim from a Google id_token payload', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ email: 'owner@example.com', sub: '123' })).toString(
      'base64url'
    )
    const idToken = `${header}.${body}.signature-not-verified`
    expect(parseIdTokenEmail(idToken)).toBe('owner@example.com')
  })

  test('returns null for missing/garbage tokens', () => {
    expect(parseIdTokenEmail(undefined)).toBeNull()
    expect(parseIdTokenEmail('only-one-segment')).toBeNull()
  })
})
