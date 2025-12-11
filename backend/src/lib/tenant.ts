import prisma from './db'

/**
 * Ensures a tenant row exists for the supplied tenantId.
 * When demoing locally we fall back to DEFAULT_TENANT_ID so that
 * the placeholder endpoints have something to attach data to.
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

export function getDefaultTenantId(): string {
  return process.env.DEFAULT_TENANT_ID || 'demo-tenant'
}

