/**
 * Runtime secret loader.
 *
 * Secrets live in AWS Secrets Manager, not in plaintext Lambda environment variables. This module
 * fetches them once per Lambda cold start and hydrates process.env so the rest of the codebase can
 * keep reading process.env.* exactly as before. It MUST be awaited at the top of every Lambda
 * handler, before any database query or third-party client is constructed.
 *
 * Two sources:
 *   1. APP_SECRETS_ARN     — one JSON secret holding all third-party API keys / signing secrets.
 *                            Each key is copied into process.env WITHOUT overwriting a value that is
 *                            already set, so a real env var, local .env, or test setup always wins.
 *   2. DATABASE_SECRET_ARN — the RDS-managed secret ({ username, password, ... }). Used to build
 *                            DATABASE_URL when it is not already provided.
 *
 * When neither ARN is set (local dev, scripts, tests) loadSecrets() is a no-op, so no AWS
 * credentials are required off-Lambda.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

// Region is picked up from the Lambda runtime (AWS_REGION). One client, reused across invocations.
const client = new SecretsManagerClient({})

let ready: Promise<void> | null = null

async function fetchSecretJson(secretId: string): Promise<Record<string, unknown>> {
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }))
  if (!res.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString value`)
  }
  return JSON.parse(res.SecretString) as Record<string, unknown>
}

/**
 * Copy string values from a secret bundle into process.env without clobbering values that are
 * already set (so a value provided via a real env var or local .env always takes precedence).
 * Returns the list of keys actually applied (for non-sensitive logging).
 */
function hydrateEnv(bundle: Record<string, unknown>): string[] {
  const applied: string[] = []
  for (const [key, value] of Object.entries(bundle)) {
    if (value === null || value === undefined) continue
    const current = process.env[key]
    if (current === undefined || current === '') {
      process.env[key] = String(value)
      applied.push(key)
    }
  }
  return applied
}

async function doLoad(): Promise<void> {
  // 1. Third-party application secrets bundle -> process.env.
  const appArn = process.env.APP_SECRETS_ARN
  if (appArn) {
    const applied = hydrateEnv(await fetchSecretJson(appArn))
    // Log key names only, never values.
    console.log(
      `[secrets] hydrated ${applied.length} app secret(s) from Secrets Manager` +
        (applied.length ? `: ${applied.join(', ')}` : '')
    )
  }

  // 2. Database credentials -> DATABASE_URL (only when not already provided by the environment).
  const dbArn = process.env.DATABASE_SECRET_ARN
  if (dbArn && !process.env.DATABASE_URL) {
    const db = await fetchSecretJson(dbArn)
    const username = String(db.username ?? '')
    const password = String(db.password ?? '')
    if (!username || !password) {
      throw new Error(`Database secret ${dbArn} is missing username/password`)
    }
    const host = process.env.DATABASE_HOST || String(db.host ?? '')
    const port = process.env.DATABASE_PORT || String(db.port ?? '5432')
    const name = process.env.DATABASE_NAME || String(db.dbname ?? 'jobdock')
    const options = process.env.DATABASE_OPTIONS || 'schema=public'
    if (!host) {
      throw new Error('DATABASE_HOST is not set and the database secret has no host')
    }
    // Matches the URL format built by resolveDatabaseUrl() in db.ts.
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(
      password
    )}@${host}:${port}/${name}?${options}`
    console.log('[secrets] built DATABASE_URL from Secrets Manager')
  }
}

/**
 * Fetch secrets from Secrets Manager and hydrate process.env. Cached for the lifetime of the
 * execution environment (warm invocations reuse the first result).
 *
 * Intentionally NON-FATAL: this runs at every handler's entry, so throwing here would take the
 * whole Lambda down on any transient Secrets Manager hiccup. Instead we log prominently and
 * continue with whatever is already in the environment. Every consumer of a secret fails closed
 * on absence (db.ts, quickbooks/crypto.ts, email.ts, approvalTokens.ts, photoToken.ts all throw
 * when their secret is missing), so a real "secret unavailable" condition still surfaces as a
 * clear, specific error at point of use rather than being silently ignored. On failure the cache
 * is cleared so the next cold invocation retries the fetch.
 */
export function loadSecrets(): Promise<void> {
  if (ready) return ready

  ready = doLoad().catch((err) => {
    console.error(
      '[secrets] failed to load from Secrets Manager; continuing with current environment:',
      err
    )
    ready = null
  })

  return ready
}
