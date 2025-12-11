import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID ?? 'demo-tenant'
  const tenantName = process.env.DEFAULT_TENANT_NAME ?? 'Demo Services'
  const ownerEmail = process.env.DEFAULT_OWNER_EMAIL ?? 'owner@demo.services'

  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: tenantName,
      subdomain: slugify(tenantId),
    },
    create: {
      id: tenantId,
      name: tenantName,
      subdomain: slugify(tenantId),
    },
  })

  const ownerUser = await prisma.user.upsert({
    where: { cognitoId: `seed-${tenantId}-owner` },
    update: {
      email: ownerEmail,
      name: 'Demo Owner',
    },
    create: {
      id: `seed-user-${tenantId}`,
      cognitoId: `seed-${tenantId}-owner`,
      email: ownerEmail,
      name: 'Demo Owner',
      tenantId: tenant.id,
      role: 'owner',
    },
  })

  const contacts = [
    {
      id: 'seed-contact-001',
      tenantId: tenant.id,
      firstName: 'Ava',
      lastName: 'Martin',
      email: 'ava.martin@example.com',
      phone: '555-0100',
      city: 'Austin',
      state: 'TX',
      status: 'active',
      tags: ['vip', 'repeat'],
      company: 'Martin Design Co.',
      notes: 'Prefers SMS confirmations.',
    },
    {
      id: 'seed-contact-002',
      tenantId: tenant.id,
      firstName: 'Luca',
      lastName: 'Nguyen',
      email: 'luca.nguyen@example.com',
      phone: '555-0101',
      city: 'Dallas',
      state: 'TX',
      status: 'lead',
      company: 'Greenfield Developments',
      tags: ['commercial'],
    },
    {
      id: 'seed-contact-003',
      tenantId: tenant.id,
      firstName: 'Mia',
      lastName: 'Reyes',
      email: 'mia.reyes@example.com',
      phone: '555-0102',
      city: 'Houston',
      state: 'TX',
      status: 'active',
      company: 'Reyes Family',
      tags: ['residential'],
    },
  ]

  for (const contact of contacts) {
    await prisma.contact.upsert({
      where: { id: contact.id },
      update: contact,
      create: contact,
    })
  }

  const services = [
    {
      id: 'seed-service-001',
      tenantId: tenant.id,
      name: 'Full Service Cleaning',
      description: 'Deep cleaning package for residential properties.',
      duration: 180,
      price: new Prisma.Decimal(420),
      isActive: true,
    },
    {
      id: 'seed-service-002',
      tenantId: tenant.id,
      name: 'Post-Construction Detail',
      description: 'Dust removal and polish service for new builds.',
      duration: 240,
      price: new Prisma.Decimal(860),
      isActive: true,
    },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service,
    })
  }

  const jobs = [
    {
      id: 'seed-job-001',
      tenantId: tenant.id,
      title: 'Ava Martin · Monthly Detail',
      contactId: 'seed-contact-001',
      serviceId: 'seed-service-001',
      startTime: tomorrowAt(9),
      endTime: tomorrowAt(12),
      status: 'scheduled',
      notes: 'Leave lavender diffuser at entrance.',
    },
    {
      id: 'seed-job-002',
      tenantId: tenant.id,
      title: 'Nguyen Lobby Polish',
      contactId: 'seed-contact-002',
      serviceId: 'seed-service-002',
      startTime: addHours(new Date(), 48),
      endTime: addHours(new Date(), 52),
      status: 'scheduled',
      notes: 'Deliver invoice onsite when finished.',
    },
  ]

  for (const job of jobs) {
    await prisma.job.upsert({
      where: { id: job.id },
      update: job,
      create: job,
    })
  }

  console.log('✅ Seed complete', {
    tenant: tenant.id,
    owner: ownerUser.email,
    contacts: contacts.length,
    services: services.length,
    jobs: jobs.length,
  })
}

function slugify(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
}

function tomorrowAt(hour: number) {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(hour, 0, 0, 0)
  return date
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

main()
  .catch((error) => {
    console.error('Seed failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


