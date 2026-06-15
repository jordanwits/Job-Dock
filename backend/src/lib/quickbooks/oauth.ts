// Intuit OAuth 2.0 (authorization code grant) helpers: authorize URL, CSRF state, token
// exchange, refresh, and revoke. Uses the global fetch available in the Node 22 Lambda runtime,
// so no extra dependency (intuit-oauth) is required.

import { createHmac, randomBytes } from 'crypto'
import {
  loadQuickBooksConfig,
  assertConfigured,
  QBO_OAUTH_AUTHORIZE_URL,
  QBO_OAUTH_TOKEN_URL,
  QBO_OAUTH_REVOKE_URL,
} from './config'
import type { OAuthTokenResponse } from './types'

// The CSRF "state" is HMAC-signed with the client secret so we can verify it on the callback
// without server-side session storage. Format: base64url(payload) "." base64url(hmac)
function signState(tenantId: string, nonce: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ t: tenantId, n: nonce })).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function buildAuthorizeUrl(tenantId: string): string {
  const cfg = loadQuickBooksConfig()
  assertConfigured(cfg)
  const state = signState(tenantId, randomBytes(16).toString('hex'), cfg.clientSecret)
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    redirect_uri: cfg.redirectUri,
    state,
  })
  return `${QBO_OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

export function verifyState(state: string, expectedTenantId: string): boolean {
  const cfg = loadQuickBooksConfig()
  const [payload, sig] = (state || '').split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', cfg.clientSecret).update(payload).digest('base64url')
  if (sig !== expected) return false
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return decoded.t === expectedTenantId
  } catch {
    return false
  }
}

async function tokenRequest(body: URLSearchParams): Promise<OAuthTokenResponse> {
  const cfg = loadQuickBooksConfig()
  assertConfigured(cfg)
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const res = await fetch(QBO_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QuickBooks token request failed (${res.status}): ${text}`)
  }
  return (await res.json()) as OAuthTokenResponse
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
  const cfg = loadQuickBooksConfig()
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
    })
  )
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
  return tokenRequest(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  )
}

export async function revokeToken(token: string): Promise<void> {
  const cfg = loadQuickBooksConfig()
  assertConfigured(cfg)
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  await fetch(QBO_OAUTH_REVOKE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ token }),
  })
}
