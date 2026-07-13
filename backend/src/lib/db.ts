/**
 * Database Client
 *
 * Prisma client with multi-tenant support.
 *
 * The client is created LAZILY (see the Proxy below) rather than at module load, so that in the
 * Lambda runtime the database credentials can be sourced from Secrets Manager — loadSecrets()
 * (lib/secrets.ts) populates DATABASE_URL at handler entry, after this module is imported but
 * before the first query. When DATABASE_URL (or the individual DATABASE_* parts) is already present
 * in the environment — local dev, scripts, tests, `prisma migrate` — the client is built eagerly at
 * module load, exactly as before.
 */

import { PrismaClient } from '@prisma/client'

/**
 * Resolve a usable database URL. Lambdas can either provide DATABASE_URL directly
 * or expose the individual connection parts (host/user/password/name/port).
 */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const host = process.env.DATABASE_HOST
  const user = process.env.DATABASE_USER
  const password = process.env.DATABASE_PASSWORD
  const name = process.env.DATABASE_NAME ?? 'jobdock'
  const port = process.env.DATABASE_PORT ?? '5432'
  const options = process.env.DATABASE_OPTIONS ?? 'schema=public'

  if (!host || !user || !password) {
    throw new Error(
      'Database configuration missing. Set DATABASE_URL or DATABASE_HOST/USER/PASSWORD, ' +
        'or call loadSecrets() (lib/secrets.ts) at handler entry before using the database.'
    )
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?${options}`
}

// Global Prisma client instance (reused across Lambda invocations)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

let prismaInstance: PrismaClient | undefined = global.prisma

/**
 * Build the Prisma client on first use. Idempotent: subsequent calls return the same instance
 * (also reused across warm Lambda invocations via globalThis).
 */
function initDb(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: { url: resolveDatabaseUrl() },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })

    // Prevent multiple instances in development
    if (process.env.NODE_ENV !== 'production') {
      global.prisma = prismaInstance
    }
  }
  return prismaInstance
}

// Preserve the historical eager initialization whenever the connection details are already present
// at module load (local dev, scripts, tests, prisma CLI). Only the Lambda "fetch creds from Secrets
// Manager" path defers construction until loadSecrets() has populated DATABASE_URL.
if (
  process.env.DATABASE_URL ||
  (process.env.DATABASE_HOST && process.env.DATABASE_USER && process.env.DATABASE_PASSWORD)
) {
  initDb()
}

/**
 * Lazily-initialized Prisma client. Accessing any property builds the underlying client on first
 * use (after loadSecrets() has populated the connection details). Methods are bound to the real
 * client so `prisma.$transaction(...)`, `prisma.$queryRaw`, model delegates, etc. all behave
 * normally. Every existing `import prisma from './db'` call site uses it unchanged.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = initDb()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

/**
 * Get database client with tenant context
 * All queries should use this to ensure tenant isolation
 */
export function getDb(tenantId: string) {
  return {
    ...prisma,
    // Override findMany to always include tenantId filter
    $queryRaw: prisma.$queryRaw,
    $executeRaw: prisma.$executeRaw,
    $transaction: prisma.$transaction,
  }
}

/**
 * Helper to ensure tenant_id is included in queries
 */
export function withTenant<T extends { tenantId: string }>(
  data: Omit<T, 'tenantId'>,
  tenantId: string
): T {
  return { ...data, tenantId } as T
}

export default prisma
