import { addMonths } from 'date-fns'
import prisma from './db'
import { ApiError } from './errors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type TesterPlanInput = 'solo' | 'single' | 'team' | 'team-plus'

function resolvePriceId(plan: string): string {
  const normalized = plan.trim().toLowerCase().replace(/_/g, '-')
  if (normalized === 'solo' || normalized === 'single') {
    const id = process.env.STRIPE_JOBDOCK_SOLO_PRICE_ID || process.env.STRIPE_PRICE_ID
    if (!id) throw new ApiError('Solo price ID not configured', 500)
    return id
  }
  if (normalized === 'team') {
    const id = process.env.STRIPE_JOBDOCK_TEAM_PRICE_ID || process.env.STRIPE_TEAM_PRICE_ID
    if (!id) throw new ApiError('Team price ID not configured', 500)
    return id
  }
  if (normalized === 'team-plus' || normalized === 'teamplus') {
    const id = process.env.STRIPE_JOBDOCK_TEAM_PLUS_PRICE_ID || process.env.STRIPE_TEAM_PLUS_PRICE_ID
    if (!id) throw new ApiError('Team+ price ID not configured', 500)
    return id
  }
  throw new ApiError('Invalid plan. Use "solo", "single", "team", or "team-plus"', 400)
}

function metadataPlanLabel(plan: string): string {
  const n = plan.trim().toLowerCase().replace(/_/g, '-')
  if (n === 'solo' || n === 'single') return 'solo'
  if (n === 'team') return 'team'
  if (n === 'team-plus' || n === 'teamplus') return 'team-plus'
  return plan
}

/**
 * Resolve owner row by JobDock `users.id`, Cognito `sub` (`users.cognitoId`), or login email.
 * (Cognito console "User ID" / sub is not the same UUID as Postgres `users.id`.)
 */
async function findUserForTesterApproval(raw: string) {
  const q = raw.trim()
  if (!q) {
    throw new ApiError('userId is required', 400)
  }

  let target = await prisma.user.findUnique({
    where: { id: q },
    include: { tenant: true },
  })

  if (!target) {
    target = await prisma.user.findUnique({
      where: { cognitoId: q },
      include: { tenant: true },
    })
  }

  if (!target && EMAIL_RE.test(q)) {
    const matches = await prisma.user.findMany({
      where: { email: { equals: q, mode: 'insensitive' } },
      include: { tenant: true },
    })
    if (matches.length > 1) {
      throw new ApiError(
        'Multiple users share that email. Use JobDock user id or Cognito sub from the database.',
        400
      )
    }
    target = matches[0] ?? null
  }

  if (!target) {
    throw new ApiError(
      'User not found. Paste JobDock user id (from database), or Cognito sub (same as users.cognitoId), or their sign-in email.',
      404
    )
  }

  return target
}

/**
 * Creates a private Stripe Checkout session for an approved tester (owner only).
 * Regenerates checkout URL on repeat calls (updates testerCheckoutUrl / testerInviteSentAt).
 */
export async function createTesterApprovalCheckout(params: {
  targetUserId: string
  plan: TesterPlanInput
}): Promise<{ checkoutUrl: string }> {
  const { targetUserId, plan } = params

  const target = await findUserForTesterApproval(targetUserId)

  if (target.role !== 'owner') {
    throw new ApiError('Tester checkout can only be generated for tenant owners', 400)
  }

  const email = target.email?.trim() || ''
  if (!email || !EMAIL_RE.test(email)) {
    throw new ApiError('User has no valid email address for Stripe checkout', 400)
  }

  const tenant = target.tenant
  if (tenant.stripeSubscriptionId) {
    const st = (tenant.stripeSubscriptionStatus || '').toLowerCase()
    if (st !== 'canceled') {
      throw new ApiError(
        'This tenant already has a subscription. Cancel or use the billing portal before issuing a tester checkout.',
        409
      )
    }
  }

  const couponId = (process.env.STRIPE_TESTER_COUPON_ID || '').trim()
  if (!couponId) {
    throw new ApiError('STRIPE_TESTER_COUPON_ID is not configured', 500)
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId: target.tenantId, role: 'owner' },
    select: { id: true },
  })
  const ownerUserId = owner?.id || target.id

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
  })

  let customerId = tenant.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        tenantId: target.tenantId,
        ownerUserId,
      },
    })
    customerId = customer.id
    await prisma.tenant.update({
      where: { id: target.tenantId },
      data: { stripeCustomerId: customerId },
    })
  }

  const priceId = resolvePriceId(plan)
  const trialEnd = addMonths(new Date(), 6)
  const trialEndUnix = Math.floor(trialEnd.getTime() / 1000)

  const baseUrl = (
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '')

  const metaTenant = target.tenantId
  const metaOwner = ownerUserId
  const metaAppUser = target.id
  const metaPlan = metadataPlanLabel(plan)

  const subscriptionMetadata = {
    tenantId: metaTenant,
    ownerUserId: metaOwner,
    appUserId: metaAppUser,
    tester: 'true',
    approvedByAdmin: 'true',
    selectedPlan: metaPlan,
  }

  const sessionMetadata = {
    ...subscriptionMetadata,
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    discounts: [{ coupon: couponId }],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_end: trialEndUnix,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
      metadata: subscriptionMetadata,
    },
    payment_method_collection: 'always',
    success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing/cancelled`,
    metadata: sessionMetadata,
  })

  const url = session.url
  if (!url) {
    throw new ApiError('Stripe did not return a checkout URL', 500)
  }

  const now = new Date()
  await prisma.user.update({
    where: { id: target.id },
    data: {
      testerApproved: true,
      testerApprovedAt: target.testerApprovedAt ?? now,
      testerInviteSentAt: now,
      testerCheckoutUrl: url,
      stripeCustomerId: customerId,
    },
  })

  return { checkoutUrl: url }
}
