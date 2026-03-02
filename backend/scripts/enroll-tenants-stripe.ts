/**
 * Enroll existing tenants in Stripe by creating Stripe customers for those
 * that don't have stripeCustomerId yet.
 *
 * Run from backend directory:
 *   npx tsx scripts/enroll-tenants-stripe.ts
 *
 * Required env vars:
 *   DATABASE_URL - PostgreSQL connection string
 *   STRIPE_SECRET_KEY - Stripe secret key
 */

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey?.trim()) {
    console.error('STRIPE_SECRET_KEY is required')
    process.exit(1)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })

  const tenants = await prisma.tenant.findMany({
    where: { stripeCustomerId: null },
    include: {
      users: true,
    },
  })

  if (tenants.length === 0) {
    console.log('All tenants are already enrolled in Stripe.')
    return
  }

  console.log(`Found ${tenants.length} tenant(s) to enroll.`)

  for (const tenant of tenants) {
    // Prefer owner, then admin, then first user
    const owner = tenant.users.find(u => u.role === 'owner')
    const admin = tenant.users.find(u => u.role === 'admin')
    const firstUser = tenant.users[0]
    const user = owner || admin || firstUser

    if (!user?.email) {
      console.warn(`  Skip ${tenant.name} (${tenant.id}): no user with email`)
      continue
    }

    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
          tenantSubdomain: tenant.subdomain,
        },
      })

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customer.id },
      })

      console.log(`  Enrolled ${tenant.name} (${tenant.subdomain}) -> ${customer.id}`)
    } catch (err) {
      console.error(`  Failed ${tenant.name}:`, err)
    }
  }

  console.log('Done.')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
