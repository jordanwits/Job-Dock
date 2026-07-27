import { classifyPublicRoute } from './publicRoutes'

/**
 * These tests pin the unauthenticated allowlist for the Data API. `any === false` means the
 * route is behind the JWT auth gate in handler.ts, so a regression here is an auth bypass.
 */
describe('classifyPublicRoute', () => {
  describe('routes that must stay public', () => {
    const publicCases: Array<[string, string, string | undefined, string | undefined, keyof ReturnType<typeof classifyPublicRoute>]> = [
      // Public booking widget
      ['GET', 'services', 'public', undefined, 'booking'],
      ['GET', 'services', 'svc-1', undefined, 'booking'],
      ['GET', 'services', 'svc-1', 'availability', 'booking'],
      ['POST', 'services', 'svc-1', 'book', 'booking'],
      // Quote / invoice approval from emailed links
      ['POST', 'quotes', 'q-1', 'approve-public', 'approval'],
      ['POST', 'quotes', 'q-1', 'decline-public', 'approval'],
      ['POST', 'invoices', 'i-1', 'approve-public', 'approval'],
      ['POST', 'invoices', 'i-1', 'decline-public', 'approval'],
      ['GET', 'quotes', 'q-1', 'approval-info', 'approvalInfo'],
      ['GET', 'invoices', 'i-1', 'approval-info', 'approvalInfo'],
      ['GET', 'quotes', 'q-1', 'public-pdf', 'pdf'],
      ['GET', 'invoices', 'i-1', 'public-pdf', 'pdf'],
      // Customer self-reschedule from a confirmation link
      ['GET', 'jobs', 'j-1', 'reschedule-info', 'rescheduleInfo'],
      ['POST', 'jobs', 'j-1', 'reschedule-public', 'reschedule'],
      // Public branding for the booking / reschedule pages
      ['GET', 'settings', 'public', undefined, 'settings'],
    ]

    it.each(publicCases)('%s /%s/%s/%s is public', (method, resource, id, action, flag) => {
      const result = classifyPublicRoute(method, resource, id, action)
      expect(result.any).toBe(true)
      expect(result[flag]).toBe(true)
    })
  })

  describe('core CRUD requires authentication', () => {
    const resources = [
      'contacts',
      'invoices',
      'quotes',
      'jobs',
      'job-logs',
      'job-recurrences',
      'bookings',
      'services',
      'settings',
      'users',
      'time-entries',
      'saved-line-items',
      'job-roles',
      'reports',
    ]
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

    it.each(methods)('%s on a collection is never public', method => {
      for (const resource of resources) {
        expect(classifyPublicRoute(method, resource, undefined, undefined).any).toBe(false)
      }
    })

    it.each(methods)('%s on a single record is never public', method => {
      for (const resource of resources) {
        // `GET /services/:id` is the one legitimate exception (public booking service detail).
        if (resource === 'services' && method === 'GET') continue
        expect(classifyPublicRoute(method, resource, 'rec-1', undefined).any).toBe(false)
      }
    })

    it('does not leak the tenant-wide services list', () => {
      expect(classifyPublicRoute('GET', 'services', undefined, undefined).any).toBe(false)
    })

    it('does not expose authenticated settings', () => {
      expect(classifyPublicRoute('GET', 'settings', undefined, undefined).any).toBe(false)
      expect(classifyPublicRoute('PUT', 'settings', undefined, undefined).any).toBe(false)
      // "public" is only a public route for GET — never for writes.
      expect(classifyPublicRoute('PUT', 'settings', 'public', undefined).any).toBe(false)
      expect(classifyPublicRoute('POST', 'settings', 'public', undefined).any).toBe(false)
    })
  })

  describe('near-miss variants stay closed', () => {
    it('rejects write methods on public booking reads', () => {
      expect(classifyPublicRoute('DELETE', 'services', 'svc-1', undefined).any).toBe(false)
      expect(classifyPublicRoute('PUT', 'services', 'svc-1', 'availability').any).toBe(false)
      expect(classifyPublicRoute('POST', 'services', 'public', undefined).any).toBe(false)
    })

    it('rejects the wrong method on token-gated approval routes', () => {
      expect(classifyPublicRoute('GET', 'quotes', 'q-1', 'approve-public').any).toBe(false)
      expect(classifyPublicRoute('POST', 'quotes', 'q-1', 'approval-info').any).toBe(false)
      expect(classifyPublicRoute('POST', 'invoices', 'i-1', 'public-pdf').any).toBe(false)
      expect(classifyPublicRoute('GET', 'jobs', 'j-1', 'reschedule-public').any).toBe(false)
      expect(classifyPublicRoute('POST', 'jobs', 'j-1', 'reschedule-info').any).toBe(false)
    })

    it('rejects public actions on the wrong resource', () => {
      expect(classifyPublicRoute('POST', 'jobs', 'j-1', 'approve-public').any).toBe(false)
      expect(classifyPublicRoute('GET', 'contacts', 'c-1', 'approval-info').any).toBe(false)
      expect(classifyPublicRoute('GET', 'invoices', 'i-1', 'reschedule-info').any).toBe(false)
      expect(classifyPublicRoute('POST', 'jobs', 'j-1', 'book').any).toBe(false)
    })

    it('requires a record id on token-gated routes', () => {
      expect(classifyPublicRoute('POST', 'quotes', undefined, 'approve-public').any).toBe(false)
      expect(classifyPublicRoute('GET', 'jobs', undefined, 'reschedule-info').any).toBe(false)
      expect(classifyPublicRoute('POST', 'services', undefined, 'book').any).toBe(false)
    })

    it('does not treat an unknown or missing resource as public', () => {
      expect(classifyPublicRoute('GET', undefined, undefined, undefined).any).toBe(false)
      expect(classifyPublicRoute('GET', 'admin', 'testers', 'approve').any).toBe(false)
      expect(classifyPublicRoute('POST', 'assistant', 'chat', undefined).any).toBe(false)
      expect(classifyPublicRoute('POST', 'help', 'chat', undefined).any).toBe(false)
      expect(classifyPublicRoute('GET', 'billing', 'status', undefined).any).toBe(false)
    })
  })
})
