import prisma from './db'

/**
 * Ensures a tenant row exists for the supplied tenantId.
 *
 * Only ever called with a tenant id that came from a verified JWT, so this can no longer
 * create a row for a caller-supplied id. (It previously ran on unauthenticated requests via
 * the removed DEFAULT_TENANT_ID fallback, which let anonymous callers create Tenant rows.)
 */
export async function ensureTenantExists(tenantId: string) {
  if (!tenantId) {
    throw new Error('Tenant ID is required')
  }

  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: tenantId,
      subdomain: tenantId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
    },
  })
}

