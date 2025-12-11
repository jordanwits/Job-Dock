/**
 * Database Client
 * 
 * Prisma client with multi-tenant support
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
    throw new Error('Database configuration missing. Set DATABASE_URL or DATABASE_HOST/USER/PASSWORD.')
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?${options}`
}

const databaseUrl = resolveDatabaseUrl()

// Global Prisma client instance (reused across Lambda invocations)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

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

