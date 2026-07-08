// Google OAuth 2.0 (authorization code grant) helpers: authorize URL, stateless HMAC-signed CSRF
// state, token exchange, refresh, and revoke. Uses the global fetch available in the Node 22 Lambda
// runtime (no googleapis SDK). Mirrors the QuickBooks oauth module.

import { createHmac, randomBytes } from 'crypto'
import {
  loadGoogleCalendarConfig,
  assertConfigured,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_REVOKE_URL,
} from './config'
import { InvalidGrantError, type GoogleOAuthTokenResponse, type SyncMode } from './types'

export interface OAuthStatePayload {
  t: string // tenantId
  u: string // userId (User.id)
  m: SyncMode // syncMode chosen at connect
  n: string // nonce
}

// The CSRF "state" is HMAC-signed with the client secret so we can verify it on the callback
// without server-side session storage. Format: base64url(payload) "." base64url(hmac)
export function signState(payload: OAuthStatePayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

// Verify signature + that the state was minted for this caller. Returns the decoded payload or null.
export function verifyState(
  state: string,
  expected: { tenantId: string; userId: string }
): OAuthStatePayload | null {
  const cfg = loadGoogleCalendarConfig()
  const [encoded, sig] = (state || '').split('.')
  if (!encoded || !sig) return null
  const expectedSig = createHmac('sha256', cfg.clientSecret).update(encoded).digest('base64url')
  if (sig !== expectedSig) return null
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload
    if (decoded.t !== expected.tenantId || decoded.u !== expected.userId) return null
    if (decoded.m !== 'all' && decoded.m !== 'mine') return null
    return decoded
  } catch {
    return null
  }
}

export function buildAuthorizeUrl(opts: {
  tenantId: string
  userId: string
  syncMode: SyncMode
}): string {
  const cfg = loadGoogleCalendarConfig()
  assertConfigured(cfg)
  const state = signState(
    { t: opts.tenantId, u: opts.userId, m: opts.syncMode, n: randomBytes(16).toString('hex') },
    cfg.clientSecret
  )
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    redirect_uri: cfg.redirectUri,
    // access_type=offline + prompt=consent forces Google to return a refresh_token every time,
    // even on re-connect (Google otherwise omits it after the first consent).
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

// Decode the email out of a Google id_token. The token came straight from Google's token endpoint
// over TLS, so we trust its payload without verifying the signature (no key fetch needed).
export function parseIdTokenEmail(idToken?: string): string | null {
  if (!idToken) return null
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

async function tokenRequest(body: URLSearchParams): Promise<GoogleOAuthTokenResponse> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  const text = await res.text()
  if (!res.ok) {
    // Google returns { "error": "invalid_grant", ... } when a refresh token is revoked/expired.
    let errorCode = ''
    try {
      errorCode = (JSON.parse(text) as { error?: string }).error || ''
    } catch {
      /* non-JSON error body */
    }
    if (errorCode === 'invalid_grant') {
      throw new InvalidGrantError()
    }
    // Never log the request body (contains secrets/tokens); log status + Google's error code only.
    console.error(`Google token request failed (${res.status}): ${errorCode || 'unknown_error'}`)
    throw new Error(`Google token request failed (${res.status}): ${errorCode || 'unknown_error'}`)
  }
  return JSON.parse(text) as GoogleOAuthTokenResponse
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokenResponse> {
  const cfg = loadGoogleCalendarConfig()
  assertConfigured(cfg)
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
    })
  )
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokenResponse> {
  const cfg = loadGoogleCalendarConfig()
  assertConfigured(cfg)
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    })
  )
}

export async function revokeToken(token: string): Promise<void> {
  // Best-effort; Google returns 200 on success, 400 if already invalid.
  try {
    await fetch(GOOGLE_OAUTH_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    })
  } catch (err) {
    console.warn('Google token revoke failed (ignored):', (err as Error)?.message)
  }
}
