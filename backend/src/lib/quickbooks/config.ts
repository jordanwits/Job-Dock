// Central configuration and endpoint constants for the QuickBooks Online integration.
// All secrets are read from the Lambda environment (injected by infrastructure/lib/jobdock-stack.ts).

export type QuickBooksEnv = 'sandbox' | 'production'

export interface QuickBooksConfig {
  env: QuickBooksEnv
  clientId: string
  clientSecret: string
  webhookVerifierToken: string
  tokenEncKey: string
  redirectUri: string
  scopes: string[]
}

// OAuth endpoints are the same host for sandbox and production; only the data API host differs.
export const QBO_OAUTH_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'
export const QBO_OAUTH_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const QBO_OAUTH_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

export const QBO_SCOPE_ACCOUNTING = 'com.intuit.quickbooks.accounting'
export const QBO_SCOPE_PAYMENTS = 'com.intuit.quickbooks.payment'

export function getAccountingApiBaseUrl(env: QuickBooksEnv): string {
  return env === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

export function getPaymentsApiBaseUrl(env: QuickBooksEnv): string {
  return env === 'production' ? 'https://api.intuit.com' : 'https://sandbox.api.intuit.com'
}

export function loadQuickBooksConfig(): QuickBooksConfig {
  const env: QuickBooksEnv =
    process.env.QUICKBOOKS_ENV === 'production' ? 'production' : 'sandbox'
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return {
    env,
    clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    webhookVerifierToken: process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN || '',
    tokenEncKey: process.env.QUICKBOOKS_TOKEN_ENC_KEY || '',
    // The Intuit Redirect URI must EXACTLY match what is registered in the Intuit app.
    // Prefer an explicit QUICKBOOKS_REDIRECT_URI: the prod app is served at www.thecleandock.com
    // while the apex 307-redirects, so deriving from PUBLIC_APP_URL (apex) would not match.
    // Fall back to deriving from PUBLIC_APP_URL for local dev.
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `${publicAppUrl}/quickbooks/callback`,
    scopes: [QBO_SCOPE_ACCOUNTING, QBO_SCOPE_PAYMENTS],
  }
}

// A QuickBooks invoice "Pay now" link only works once the company has QuickBooks Payments
// enrolled. In sandbox (and for production companies that have not enrolled) Intuit returns a
// developer.intuit.com "coming soon" placeholder instead of a real hosted pay page. Never surface
// that placeholder to a paying customer — treat only a real Intuit-hosted link as usable.
export function isUsablePayUrl(url?: string | null): boolean {
  if (!url) return false
  return !/developer\.intuit\.com|comingSoon/i.test(url)
}

export function isConfigured(): boolean {
  const cfg = loadQuickBooksConfig()
  return Boolean(cfg.clientId && cfg.clientSecret)
}

export function assertConfigured(cfg: QuickBooksConfig): void {
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('QuickBooks is not configured (missing QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET)')
  }
}
