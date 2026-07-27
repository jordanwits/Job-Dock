/**
 * Public (unauthenticated) route allowlist for the Data API.
 *
 * This is the security boundary for the data Lambda: EVERY route that is not classified as
 * public here requires a verified Cognito JWT (see the auth gate in `handler.ts`). Routes
 * listed here are reachable with no Authorization header, so each one must derive its tenant
 * from the resource itself — a record id, a signed token, or an explicit query param — and
 * never from a caller-supplied `X-Tenant-ID` header.
 *
 * Kept as a pure function, separate from the handler, so the allowlist can be unit-tested
 * directly and reviewed in one place.
 *
 * Not covered here (handled earlier in `handler.ts`, before this classification runs):
 * short links `/s/:code`, the Stripe and QuickBooks webhooks (signature-verified), the
 * `/job-logs/:id/photo-file` proxy (signed photo token), and the `MIGRATE_SECRET`-gated
 * debug endpoints.
 */
export interface PublicRouteFlags {
  /** Public booking widget: service listing, service detail, availability, and slot booking. */
  booking: boolean
  /** Customer accept/decline of a quote or invoice (signed approval token). */
  approval: boolean
  /** Branding/metadata for the public approval page (signed approval token). */
  approvalInfo: boolean
  /** Rendered quote/invoice PDF for the public view page (signed approval token). */
  pdf: boolean
  /** Booking details for the public reschedule page (signed reschedule token). */
  rescheduleInfo: boolean
  /** Customer-submitted reschedule (signed reschedule token). */
  reschedule: boolean
  /** Public tenant branding for booking/reschedule pages (tenant from the query param). */
  settings: boolean
  /** True when the request matches any public route. */
  any: boolean
}

export function classifyPublicRoute(
  method: string,
  resource: string | undefined,
  id: string | undefined,
  action: string | undefined
): PublicRouteFlags {
  // GET /services/public?tenantId=, GET /services/:id, GET /services/:id/availability,
  // POST /services/:id/book
  const booking =
    resource === 'services' &&
    ((method === 'GET' && id === 'public') ||
      (!!id && id !== 'public' && method === 'GET' && (action === 'availability' || !action)) ||
      (!!id && id !== 'public' && method === 'POST' && action === 'book'))

  // POST /quotes|invoices/:id/approve-public|decline-public
  const approval =
    method === 'POST' &&
    !!id &&
    (resource === 'quotes' || resource === 'invoices') &&
    (action === 'approve-public' || action === 'decline-public')

  // GET /quotes|invoices/:id/approval-info
  const approvalInfo =
    method === 'GET' &&
    !!id &&
    (resource === 'quotes' || resource === 'invoices') &&
    action === 'approval-info'

  // GET /quotes|invoices/:id/public-pdf
  const pdf =
    method === 'GET' &&
    !!id &&
    (resource === 'quotes' || resource === 'invoices') &&
    action === 'public-pdf'

  // GET /jobs/:id/reschedule-info
  const rescheduleInfo =
    method === 'GET' && resource === 'jobs' && !!id && action === 'reschedule-info'

  // POST /jobs/:id/reschedule-public
  const reschedule =
    method === 'POST' && resource === 'jobs' && !!id && action === 'reschedule-public'

  // GET /settings/public?tenantId= — public branding only (company name + logo).
  const settings = method === 'GET' && resource === 'settings' && id === 'public'

  return {
    booking,
    approval,
    approvalInfo,
    pdf,
    rescheduleInfo,
    reschedule,
    settings,
    any:
      booking ||
      approval ||
      approvalInfo ||
      pdf ||
      rescheduleInfo ||
      reschedule ||
      settings,
  }
}
