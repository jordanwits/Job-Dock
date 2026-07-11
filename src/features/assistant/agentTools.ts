/**
 * Agent tool registry for the CleanDock AI assistant.
 *
 * Each tool wraps an existing API service (contactsService, jobsService, …).
 * Because those services auto-switch between mock and live data
 * (see src/lib/api/services.ts), these tools work in BOTH modes with no
 * changes — in mock mode they mutate localStorage and the UI updates live;
 * in live mode they hit the real backend.
 *
 * Tools flagged `mutates: true` are gated behind a user confirmation step
 * by the agent loop (see assistantClient.ts).
 */
import type OpenAI from 'openai'
import {
  bookingsService,
  contactsService,
  invoicesService,
  jobsService,
  quotesService,
  servicesService,
} from '@/lib/api/services'
import { helpApi } from '@/lib/api/help'
import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/features/quotes/types/quote'
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '@/features/invoices/types/invoice'
import type { DataEntity } from './dataEvents'

/** Runtime context handed to a tool when it executes (not from the model). */
export interface ToolContext {
  /** The route the user is currently viewing — used as a hint for help answers. */
  clientRoute?: string
}

export interface AgentTool {
  /** Tool name exposed to the model. */
  name: string
  /** Whether this tool writes data (requires user confirmation before running). */
  mutates: boolean
  /** Destructive (e.g. delete) — shown with an emphatic, irreversible-warning confirm. */
  destructive?: boolean
  /** Which data store(s) this write affects, so views can refresh after it runs. */
  affects?: DataEntity | DataEntity[]
  /** OpenAI function/tool schema. */
  schema: OpenAI.Chat.Completions.ChatCompletionTool
  /**
   * Short, human-readable summary of the action — shown in the confirm prompt
   * (for writes) and as the activity status line while the tool runs. NEVER
   * include raw record ids here; resolve a friendly label (number/title/name)
   * instead. May be async so it can look the record up first.
   */
  summarize?: (args: any) => string | Promise<string>
  /** Execute the tool. Returns a JSON-serializable result handed back to the model. */
  execute: (args: any, ctx?: ToolContext) => Promise<unknown>
}

// --- Helpers ---------------------------------------------------------------

/** Format a number as USD for display, or null when there's nothing to show. */
const money = (n: any): string | null =>
  n == null || n === ''
    ? null
    : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Friendly percent from a decimal rate (0.08 -> "8%"), or null. */
const percent = (rate: any): string | null => {
  if (rate == null || rate === '') return null
  const pct = Number(rate) * 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`
}

const JOB_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'pending-confirmation': 'Pending confirmation',
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
}
const quoteStatusLabel = (s: any) => QUOTE_STATUS_LABELS[s as QuoteStatus] || s || null
const invoiceStatusLabel = (s: any) => INVOICE_STATUS_LABELS[s as InvoiceStatus] || s || null
const jobStatusLabel = (s: any) => JOB_STATUS_LABELS[s] || s || null
const paymentStatusLabel = (s: any) => (s ? PAYMENT_STATUS_LABELS[s] || s : null)

const contactName = (c: any) =>
  [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || c?.contactName || 'Unnamed'

/** Trim a contact to the fields needed for lists/lookups (keeps token cost low). */
const slimContact = (c: any) => ({
  id: c?.id,
  name: contactName(c),
  email: c?.email || null,
  phone: c?.phone || null,
  company: c?.company || null,
})

/** Full contact detail for editing context. */
const detailContact = (c: any) => ({
  id: c?.id,
  firstName: c?.firstName || '',
  lastName: c?.lastName || '',
  email: c?.email || null,
  phone: c?.phone || null,
  company: c?.company || null,
  jobTitle: c?.jobTitle || null,
  address: c?.address || null,
  city: c?.city || null,
  state: c?.state || null,
  zipCode: c?.zipCode || null,
  notes: c?.notes || null,
  status: c?.status || null,
})

const slimService = (s: any) => ({
  id: s?.id,
  name: s?.name,
  durationMinutes: s?.duration ?? null,
  price: money(s?.price),
  isActive: s?.isActive ?? true,
})

const slimJob = (j: any) => ({
  id: j?.id,
  // Every occurrence of a recurring appointment shares the job id; bookingId is the only
  // handle that names ONE occurrence. Mutation tools need it to target precisely.
  bookingId: j?.bookingId || null,
  recurrenceId: j?.recurrenceId || null,
  occurrenceCount: j?.occurrenceCount ?? null,
  title: j?.title,
  contactName: j?.contactName || null,
  serviceName: j?.serviceName || null,
  startTime: j?.startTime || null,
  endTime: j?.endTime || null,
  status: jobStatusLabel(j?.status),
  location: j?.location || null,
})

const detailJob = (j: any) => ({
  ...slimJob(j),
  contactId: j?.contactId || null,
  serviceId: j?.serviceId || null,
  description: j?.description || null,
  notes: j?.notes || null,
  toBeScheduled: j?.toBeScheduled ?? false,
})

const slimLineItem = (li: any) => ({
  description: li?.description || '',
  quantity: li?.quantity ?? null,
  unitPrice: money(li?.unitPrice),
  total: money(li?.total),
})

const slimQuote = (q: any) => ({
  id: q?.id,
  quoteNumber: q?.quoteNumber,
  title: q?.title || null,
  contactName: q?.contactName || null,
  total: money(q?.total),
  status: quoteStatusLabel(q?.status),
})

const detailQuote = (q: any) => ({
  ...slimQuote(q),
  contactId: q?.contactId || null,
  lineItems: Array.isArray(q?.lineItems) ? q.lineItems.map(slimLineItem) : [],
  subtotal: money(q?.subtotal),
  taxRate: percent(q?.taxRate),
  discount: money(q?.discount),
  notes: q?.notes || null,
  validUntil: q?.validUntil || null,
})

const slimInvoice = (i: any) => ({
  id: i?.id,
  invoiceNumber: i?.invoiceNumber,
  title: i?.title || null,
  contactName: i?.contactName || null,
  total: money(i?.total),
  status: invoiceStatusLabel(i?.status),
  paymentStatus: paymentStatusLabel(i?.paymentStatus),
})

const detailInvoice = (i: any) => ({
  ...slimInvoice(i),
  contactId: i?.contactId || null,
  lineItems: Array.isArray(i?.lineItems) ? i.lineItems.map(slimLineItem) : [],
  subtotal: money(i?.subtotal),
  taxRate: percent(i?.taxRate),
  discount: money(i?.discount),
  notes: i?.notes || null,
  dueDate: i?.dueDate || null,
  paymentTerms: i?.paymentTerms || null,
})

/** Normalize line items the model passes (description/quantity/unitPrice). */
const normalizeLineItems = (items: any): { description: string; quantity: number; unitPrice: number }[] =>
  (Array.isArray(items) ? items : []).map((li: any) => ({
    description: li?.description || '',
    quantity: Number(li?.quantity ?? 1),
    unitPrice: Number(li?.unitPrice ?? 0),
  }))

/**
 * Ensure a quote/invoice always has a sensible project-style title. Prefers the
 * title the model provided; otherwise derives one from the line items so the
 * document never shows up blank (lists fall back to the number otherwise).
 */
const deriveDocTitle = (
  explicit: unknown,
  lineItems: { description: string }[],
  fallback: string
): string => {
  const provided = String(explicit ?? '').trim()
  if (provided) return provided
  const first = (lineItems[0]?.description ?? '').trim()
  if (first) {
    const capped = first.charAt(0).toUpperCase() + first.slice(1)
    return lineItems.length > 1 ? `${capped} + ${lineItems.length - 1} more` : capped
  }
  return fallback
}

const lineItemSchema = {
  type: 'array',
  description: 'Line items. Totals are calculated automatically.',
  items: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      quantity: { type: 'number' },
      unitPrice: { type: 'number' },
    },
    required: ['description', 'quantity', 'unitPrice'],
  },
} as const

/** Strip undefined keys so updates only touch provided fields. */
const definedOnly = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

const jobStatusEnum = ['scheduled', 'in-progress', 'completed', 'cancelled', 'pending-confirmation'] as const

/**
 * Friendly-label resolvers used to build confirmation/activity summaries.
 *
 * These never expose a raw record id: they look the record up and return a
 * human label ("quote Q-1042 — Kitchen Remodel"), falling back to a generic
 * phrase if the lookup fails. Used only for the summary string, so a failed
 * lookup is non-fatal — the action itself still runs.
 */
const labelContact = async (id?: string): Promise<string> => {
  if (!id) return 'the customer'
  try {
    return contactName(await contactsService.getById(id))
  } catch {
    return 'the customer'
  }
}
const labelQuote = async (id?: string): Promise<string> => {
  if (!id) return 'the quote'
  try {
    const q: any = await quotesService.getById(id)
    if (!q) return 'the quote'
    return `quote ${q.quoteNumber}${q.title ? ` — ${q.title}` : ''}`
  } catch {
    return 'the quote'
  }
}
const labelInvoice = async (id?: string): Promise<string> => {
  if (!id) return 'the invoice'
  try {
    const i: any = await invoicesService.getById(id)
    if (!i) return 'the invoice'
    return `invoice ${i.invoiceNumber}${i.title ? ` — ${i.title}` : ''}`
  } catch {
    return 'the invoice'
  }
}
const labelJob = async (id?: string): Promise<string> => {
  if (!id) return 'the appointment'
  try {
    const j: any = await jobsService.getById(id)
    return j?.title ? `“${j.title}”` : 'the appointment'
  } catch {
    return 'the appointment'
  }
}

// --- Tools -----------------------------------------------------------------

export const agentTools: AgentTool[] = [
  // ----- Help / how-to (product knowledge base) -----
  {
    name: 'search_help',
    mutates: false,
    summarize: () => 'Searching help',
    schema: {
      type: 'function',
      function: {
        name: 'search_help',
        description:
          "Answer a question about HOW TO USE CleanDock — features, where to find something, what a screen/field/status means, settings, billing, role permissions, or troubleshooting something that isn't working. Searches CleanDock's official help knowledge base and returns a grounded answer. Use this for any 'how do I…', 'where is…', 'why can't I…', or 'is it possible to…' product question instead of answering from memory, so you never invent CleanDock UI details, screen names, or steps.",
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description:
                "A clear, self-contained question about using CleanDock, e.g. 'How do I send a quote to a customer?'. Include any relevant detail the user gave.",
            },
          },
          required: ['question'],
        },
      },
    },
    async execute(args: { question: string }, ctx?: ToolContext) {
      const res = await helpApi.chat({
        message: String(args?.question || '').trim(),
        clientRoute: ctx?.clientRoute,
      })
      return { answer: res.reply, sources: res.sources }
    },
  },

  // ----- Contacts -----
  {
    name: 'list_contacts',
    mutates: false,
    summarize: () => 'Looking up customers',
    schema: {
      type: 'function',
      function: {
        name: 'list_contacts',
        description:
          'List contacts (customers). Use this to find a contact id before creating/editing a quote, invoice, or appointment for an existing customer.',
        parameters: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Optional case-insensitive filter on name, email, or company.',
            },
          },
        },
      },
    },
    async execute(args: { search?: string }) {
      const all = (await contactsService.getAll()) as any[]
      const term = (args?.search || '').trim().toLowerCase()
      const filtered = term
        ? all.filter(c =>
            [contactName(c), c?.email, c?.company]
              .filter(Boolean)
              .some((v: string) => String(v).toLowerCase().includes(term))
          )
        : all
      return { count: filtered.length, contacts: filtered.slice(0, 50).map(slimContact) }
    },
  },

  {
    name: 'get_contact',
    mutates: false,
    summarize: () => 'Loading customer details',
    schema: {
      type: 'function',
      function: {
        name: 'get_contact',
        description: 'Get the full details of one contact by id (useful before editing).',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async execute(args: { id: string }) {
      return detailContact(await contactsService.getById(args.id))
    },
  },

  {
    name: 'create_contact',
    mutates: true,
    affects: 'contacts',
    summarize: a =>
      `Create contact "${[a?.firstName, a?.lastName].filter(Boolean).join(' ')}"${a?.email ? ` (${a.email})` : ''}`,
    schema: {
      type: 'function',
      function: {
        name: 'create_contact',
        description: 'Create a new contact (customer). Returns the created contact including its id.',
        parameters: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            jobTitle: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zipCode: { type: 'string' },
            notes: { type: 'string' },
            status: {
              type: 'string',
              enum: ['lead', 'prospect', 'customer', 'inactive', 'contact'],
            },
          },
          required: ['firstName'],
        },
      },
    },
    async execute(args: any) {
      const created = await contactsService.create(
        definedOnly({
          firstName: args?.firstName || '',
          lastName: args?.lastName || '',
          email: args?.email,
          phone: args?.phone,
          company: args?.company,
          jobTitle: args?.jobTitle,
          address: args?.address,
          city: args?.city,
          state: args?.state,
          zipCode: args?.zipCode,
          notes: args?.notes,
          status: args?.status,
        })
      )
      return detailContact(created)
    },
  },

  {
    name: 'update_contact',
    mutates: true,
    affects: 'contacts',
    summarize: async a => `Update ${await labelContact(a?.id)}’s details`,
    schema: {
      type: 'function',
      function: {
        name: 'update_contact',
        description:
          'Update an existing contact. Only the fields you pass are changed. Find the id with list_contacts/get_contact first.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            jobTitle: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zipCode: { type: 'string' },
            notes: { type: 'string' },
            status: {
              type: 'string',
              enum: ['lead', 'prospect', 'customer', 'inactive', 'contact'],
            },
          },
          required: ['id'],
        },
      },
    },
    async execute(args: any) {
      const { id, ...rest } = args || {}
      const updated = await contactsService.update(id, definedOnly(rest))
      return detailContact(updated)
    },
  },

  // ----- Services -----
  {
    name: 'list_services',
    mutates: false,
    summarize: () => 'Checking your services',
    schema: {
      type: 'function',
      function: {
        name: 'list_services',
        description:
          'List the bookable services (name, duration in minutes, price). Use to pick a serviceId or infer an appointment duration.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute() {
      const all = (await servicesService.getAll()) as any[]
      return { count: all.length, services: all.map(slimService) }
    },
  },

  // ----- Jobs / appointments -----
  {
    name: 'list_jobs',
    mutates: false,
    summarize: () => 'Checking your schedule',
    schema: {
      type: 'function',
      function: {
        name: 'list_jobs',
        description:
          'List jobs / appointments on the schedule, optionally within a date range. Use to answer schedule questions or find an appointment to edit. Recurring appointments appear once per occurrence, all sharing the same job id — bookingId is what identifies one specific occurrence.',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'ISO 8601 lower bound (inclusive).' },
            endDate: { type: 'string', description: 'ISO 8601 upper bound (inclusive).' },
          },
        },
      },
    },
    async execute(args: { startDate?: string; endDate?: string }) {
      const start = args?.startDate ? new Date(args.startDate) : undefined
      const end = args?.endDate ? new Date(args.endDate) : undefined
      const all = (await jobsService.getAll(start, end)) as any[]
      return { count: all.length, jobs: all.slice(0, 50).map(slimJob) }
    },
  },

  {
    name: 'get_job',
    mutates: false,
    summarize: () => 'Loading appointment details',
    schema: {
      type: 'function',
      function: {
        name: 'get_job',
        description: 'Get the full details of one job / appointment by id (useful before editing).',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async execute(args: { id: string }) {
      return detailJob(await jobsService.getById(args.id))
    },
  },

  {
    name: 'create_appointment',
    mutates: true,
    affects: 'jobs',
    summarize: async a => {
      const who = a?.contactId ? ` for ${await labelContact(a.contactId)}` : ''
      if (a?.toBeScheduled) return `Add “${a?.title || 'appointment'}”${who} (to be scheduled)`
      const when = a?.startTime
        ? new Date(a.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'an unspecified time'
      return `Book “${a?.title || 'appointment'}”${who} at ${when}`
    },
    schema: {
      type: 'function',
      function: {
        name: 'create_appointment',
        description:
          'Create a job / appointment on the schedule. Provide startTime and endTime (ISO 8601 with local offset) for a scheduled appointment, or set toBeScheduled:true and omit times for an unscheduled job. Link to an existing customer via contactId (use list_contacts/create_contact first).',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short title for the appointment.' },
            contactId: { type: 'string', description: 'Id of an existing contact, if any.' },
            serviceId: { type: 'string', description: 'Id of the service being booked, if any.' },
            startTime: { type: 'string', description: 'ISO 8601 start time with local offset.' },
            endTime: { type: 'string', description: 'ISO 8601 end time with local offset.' },
            toBeScheduled: {
              type: 'boolean',
              description: 'True for a job with no set time yet (omit startTime/endTime).',
            },
            location: { type: 'string' },
            description: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['title'],
        },
      },
    },
    async execute(args: any) {
      const created = await jobsService.create(
        definedOnly({
          title: args?.title,
          contactId: args?.contactId,
          serviceId: args?.serviceId,
          startTime: args?.startTime,
          endTime: args?.endTime,
          toBeScheduled: args?.toBeScheduled,
          location: args?.location,
          description: args?.description,
          notes: args?.notes,
          status: args?.toBeScheduled ? undefined : 'scheduled',
        }) as any
      )
      return detailJob(created)
    },
  },

  {
    name: 'update_appointment',
    mutates: true,
    affects: 'jobs',
    summarize: async a => `Update ${await labelJob(a?.id)}`,
    schema: {
      type: 'function',
      function: {
        name: 'update_appointment',
        description:
          'Update / reschedule an existing job or appointment. Only the fields you pass are changed. Find the id with list_jobs/get_job first. When rescheduling one occurrence of a recurring appointment, you MUST also pass that occurrence\'s bookingId (from list_jobs).',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            bookingId: {
              type: 'string',
              description:
                'The specific occurrence to change (from list_jobs). Required when rescheduling an occurrence of a recurring appointment.',
            },
            title: { type: 'string' },
            contactId: { type: 'string' },
            serviceId: { type: 'string' },
            startTime: { type: 'string', description: 'ISO 8601 with local offset.' },
            endTime: { type: 'string', description: 'ISO 8601 with local offset.' },
            location: { type: 'string' },
            description: { type: 'string' },
            notes: { type: 'string' },
            status: { type: 'string', enum: jobStatusEnum as unknown as string[] },
          },
          required: ['id'],
        },
      },
    },
    async execute(args: any) {
      const { id, ...rest } = args || {}
      const payload = definedOnly(rest)
      // Rescheduling must target the existing booking row: without a bookingId the backend
      // treats new times as an ADDITIONAL appointment for the job (that create-branch serves
      // the calendar's "link another visit" flow) and the result is a silent duplicate.
      if ((payload.startTime || payload.endTime) && !payload.bookingId) {
        const job: any = await jobsService.getById(id)
        if (job?.recurrenceId && (job?.occurrenceCount ?? 0) > 1) {
          return {
            error:
              'This is a recurring appointment with multiple occurrences sharing this id. Pass the bookingId of the occurrence to reschedule (find it with list_jobs).',
            occurrenceCount: job.occurrenceCount,
          }
        }
        if (job?.bookingId) payload.bookingId = job.bookingId
      }
      const updated = await jobsService.update(id, payload)
      return detailJob(updated)
    },
  },

  // ----- Quotes -----
  {
    name: 'list_quotes',
    mutates: false,
    summarize: () => 'Looking up your quotes',
    schema: {
      type: 'function',
      function: {
        name: 'list_quotes',
        description: 'List quotes (number, contact, total, status).',
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute() {
      const all = (await quotesService.getAll()) as any[]
      return { count: all.length, quotes: all.slice(0, 50).map(slimQuote) }
    },
  },

  {
    name: 'get_quote',
    mutates: false,
    summarize: () => 'Loading quote details',
    schema: {
      type: 'function',
      function: {
        name: 'get_quote',
        description: 'Get full quote details including line items (useful before editing).',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      return detailQuote(await quotesService.getById(args.id))
    },
  },

  {
    name: 'create_quote',
    mutates: true,
    affects: 'quotes',
    summarize: async a => {
      const items = normalizeLineItems(a?.lineItems)
      const title = deriveDocTitle(a?.title, items, 'New Quote')
      const who = a?.contactId ? ` for ${await labelContact(a.contactId)}` : ''
      return `Create quote “${title}”${who}`
    },
    schema: {
      type: 'function',
      function: {
        name: 'create_quote',
        description:
          'Create a quote for a contact. Requires contactId (use list_contacts/create_contact first) and at least one line item.',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            title: {
              type: 'string',
              description:
                "A short, descriptive project title for the work (Title Case), e.g. 'Kitchen Remodel' or 'Drain Repair'. Always provide one. Do NOT put the customer's name in the title.",
            },
            lineItems: lineItemSchema,
            taxRate: { type: 'number', description: 'Decimal rate, e.g. 0.08 for 8%.' },
            discount: { type: 'number' },
            notes: { type: 'string' },
            validUntil: { type: 'string', description: 'ISO 8601 date.' },
          },
          required: ['contactId', 'lineItems'],
        },
      },
    },
    async execute(args: any) {
      const lineItems = normalizeLineItems(args?.lineItems)
      const created = await quotesService.create(
        definedOnly({
          contactId: args?.contactId,
          title: deriveDocTitle(args?.title, lineItems, 'New Quote'),
          lineItems,
          taxRate: args?.taxRate,
          discount: args?.discount,
          notes: args?.notes,
          validUntil: args?.validUntil,
          status: 'draft',
        }) as any
      )
      return detailQuote(created)
    },
  },

  {
    name: 'update_quote',
    mutates: true,
    affects: 'quotes',
    summarize: async a => `Update ${await labelQuote(a?.id)}`,
    schema: {
      type: 'function',
      function: {
        name: 'update_quote',
        description:
          'Update an existing quote. Only the fields you pass change. If you pass lineItems, they REPLACE the existing ones — fetch with get_quote first if you need to keep some. Find the id with list_quotes.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            lineItems: lineItemSchema,
            taxRate: { type: 'number' },
            discount: { type: 'number' },
            notes: { type: 'string' },
            validUntil: { type: 'string' },
            status: {
              type: 'string',
              enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
            },
          },
          required: ['id'],
        },
      },
    },
    async execute(args: any) {
      const { id, lineItems, ...rest } = args || {}
      const payload = definedOnly({
        ...rest,
        lineItems: lineItems !== undefined ? normalizeLineItems(lineItems) : undefined,
      })
      return detailQuote(await quotesService.update(id, payload as any))
    },
  },

  {
    name: 'send_quote',
    mutates: true,
    affects: 'quotes',
    summarize: async a => `Send ${await labelQuote(a?.id)} to the customer`,
    schema: {
      type: 'function',
      function: {
        name: 'send_quote',
        description:
          "Email a quote to its contact and mark it as sent. The contact must have an email. Find the id with list_quotes.",
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      return slimQuote(await quotesService.send(args.id))
    },
  },

  // ----- Invoices -----
  {
    name: 'list_invoices',
    mutates: false,
    summarize: () => 'Looking up your invoices',
    schema: {
      type: 'function',
      function: {
        name: 'list_invoices',
        description: 'List invoices (number, contact, total, status, payment status).',
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute() {
      const all = (await invoicesService.getAll()) as any[]
      return { count: all.length, invoices: all.slice(0, 50).map(slimInvoice) }
    },
  },

  {
    name: 'get_invoice',
    mutates: false,
    summarize: () => 'Loading invoice details',
    schema: {
      type: 'function',
      function: {
        name: 'get_invoice',
        description: 'Get full invoice details including line items (useful before editing).',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      return detailInvoice(await invoicesService.getById(args.id))
    },
  },

  {
    name: 'create_invoice',
    mutates: true,
    affects: 'invoices',
    summarize: async a => {
      const items = normalizeLineItems(a?.lineItems)
      const title = deriveDocTitle(a?.title, items, 'New Invoice')
      const who = a?.contactId ? ` for ${await labelContact(a.contactId)}` : ''
      return `Create invoice “${title}”${who}`
    },
    schema: {
      type: 'function',
      function: {
        name: 'create_invoice',
        description:
          'Create an invoice for a contact. Requires contactId (use list_contacts/create_contact first) and at least one line item.',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            title: {
              type: 'string',
              description:
                "A short, descriptive project title for the work (Title Case), e.g. 'Kitchen Remodel' or 'Drain Repair'. Always provide one. Do NOT put the customer's name in the title.",
            },
            lineItems: lineItemSchema,
            taxRate: { type: 'number', description: 'Decimal rate, e.g. 0.08 for 8%.' },
            discount: { type: 'number' },
            notes: { type: 'string' },
            dueDate: { type: 'string', description: 'ISO 8601 date.' },
            paymentTerms: { type: 'string', description: "e.g. 'Net 30'." },
          },
          required: ['contactId', 'lineItems'],
        },
      },
    },
    async execute(args: any) {
      const lineItems = normalizeLineItems(args?.lineItems)
      const created = await invoicesService.create(
        definedOnly({
          contactId: args?.contactId,
          title: deriveDocTitle(args?.title, lineItems, 'New Invoice'),
          lineItems,
          taxRate: args?.taxRate,
          discount: args?.discount,
          notes: args?.notes,
          dueDate: args?.dueDate,
          paymentTerms: args?.paymentTerms,
          status: 'draft',
        }) as any
      )
      return detailInvoice(created)
    },
  },

  {
    name: 'update_invoice',
    mutates: true,
    affects: 'invoices',
    summarize: async a => `Update ${await labelInvoice(a?.id)}`,
    schema: {
      type: 'function',
      function: {
        name: 'update_invoice',
        description:
          'Update an existing invoice. Only the fields you pass change. If you pass lineItems, they REPLACE the existing ones — fetch with get_invoice first if you need to keep some. Find the id with list_invoices.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            lineItems: lineItemSchema,
            taxRate: { type: 'number' },
            discount: { type: 'number' },
            notes: { type: 'string' },
            dueDate: { type: 'string' },
            paymentTerms: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'sent', 'overdue', 'cancelled'] },
            paymentStatus: { type: 'string', enum: ['pending', 'partial', 'paid'] },
          },
          required: ['id'],
        },
      },
    },
    async execute(args: any) {
      const { id, lineItems, ...rest } = args || {}
      const payload = definedOnly({
        ...rest,
        lineItems: lineItems !== undefined ? normalizeLineItems(lineItems) : undefined,
      })
      return detailInvoice(await invoicesService.update(id, payload as any))
    },
  },

  {
    name: 'send_invoice',
    mutates: true,
    affects: 'invoices',
    summarize: async a => `Send ${await labelInvoice(a?.id)} to the customer`,
    schema: {
      type: 'function',
      function: {
        name: 'send_invoice',
        description:
          'Email an invoice to its contact and mark it as sent. The contact must have an email. Find the id with list_invoices.',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      return slimInvoice(await invoicesService.send(args.id))
    },
  },

  // ----- Workflows: convert & payment -----
  {
    name: 'convert_quote_to_invoice',
    mutates: true,
    affects: ['quotes', 'invoices'],
    summarize: async a => `Convert ${await labelQuote(a?.quoteId)} into a new invoice`,
    schema: {
      type: 'function',
      function: {
        name: 'convert_quote_to_invoice',
        description:
          "Create a draft invoice from an existing quote (copies its line items, tax, discount, and contact) and mark the quote as accepted. Find the quote id with list_quotes.",
        parameters: {
          type: 'object',
          properties: {
            quoteId: { type: 'string' },
            dueDate: { type: 'string', description: 'Optional ISO 8601 due date for the invoice.' },
            paymentTerms: { type: 'string', description: "Optional, e.g. 'Net 30'." },
          },
          required: ['quoteId'],
        },
      },
    },
    async execute(args: { quoteId: string; dueDate?: string; paymentTerms?: string }) {
      const q: any = await quotesService.getById(args.quoteId)
      const lineItems = normalizeLineItems(q?.lineItems)
      const invoice = await invoicesService.create(
        definedOnly({
          contactId: q?.contactId,
          title: deriveDocTitle(q?.title, lineItems, 'New Invoice'),
          lineItems,
          taxRate: q?.taxRate,
          discount: q?.discount,
          notes: q?.notes,
          dueDate: args?.dueDate,
          paymentTerms: args?.paymentTerms,
          status: 'draft',
          convertedFromQuoteNumber: q?.quoteNumber,
          convertedFromQuoteTotal: q?.total,
          convertedFromQuoteCreatedAt: q?.createdAt,
        }) as any
      )
      let quoteMarkedAccepted = false
      try {
        await quotesService.update(args.quoteId, { status: 'accepted' } as any)
        quoteMarkedAccepted = true
      } catch {
        // Non-fatal: invoice still created even if the quote status update fails.
      }
      return { invoice: detailInvoice(invoice), quoteMarkedAccepted }
    },
  },

  {
    name: 'record_payment',
    mutates: true,
    affects: 'invoices',
    summarize: async a => {
      const amt = a?.paidAmount != null ? ` (${money(a.paidAmount)})` : ''
      return `Mark ${await labelInvoice(a?.id)} as ${paymentStatusLabel(a?.paymentStatus)}${amt}`
    },
    schema: {
      type: 'function',
      function: {
        name: 'record_payment',
        description:
          "Record an invoice's payment status. Use 'paid' for paid in full, 'partial' with paidAmount for a partial payment, or 'pending' to reset. Find the id with list_invoices.",
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            paymentStatus: { type: 'string', enum: ['paid', 'partial', 'pending'] },
            paidAmount: {
              type: 'number',
              description: "Required when paymentStatus is 'partial' — the amount paid so far.",
            },
          },
          required: ['id', 'paymentStatus'],
        },
      },
    },
    async execute(args: any) {
      const updated = await invoicesService.update(
        args.id,
        definedOnly({ paymentStatus: args?.paymentStatus, paidAmount: args?.paidAmount }) as any
      )
      return detailInvoice(updated)
    },
  },

  // ----- Deletes (destructive) -----
  {
    name: 'delete_contact',
    mutates: true,
    destructive: true,
    affects: 'contacts',
    summarize: async a => `Delete ${await labelContact(a?.id)} — this can’t be undone`,
    schema: {
      type: 'function',
      function: {
        name: 'delete_contact',
        description:
          'Permanently delete a contact. Destructive — confirm the user really means this contact (find it with list_contacts first).',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      await contactsService.delete(args.id)
      return { deleted: true, id: args.id }
    },
  },

  {
    name: 'delete_appointment',
    mutates: true,
    destructive: true,
    affects: 'jobs',
    summarize: async a =>
      a?.allOccurrences
        ? `Archive EVERY occurrence of ${await labelJob(a?.id)} (restorable from Archived)`
        : `Archive ${await labelJob(a?.id)}${a?.bookingId ? ' — this occurrence only' : ''} (restorable from Archived)`,
    schema: {
      type: 'function',
      function: {
        name: 'delete_appointment',
        description:
          'Archive (delete) an appointment — a restorable soft-delete (Scheduling > Archived). Recurring appointments: every occurrence shares one job id, so to delete ONE occurrence you MUST pass its bookingId (from list_jobs); pass allOccurrences: true ONLY if the user explicitly asked to delete the entire series. Find the appointment with list_jobs first and confirm which one.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            bookingId: {
              type: 'string',
              description: 'The specific occurrence to archive (from list_jobs).',
            },
            allOccurrences: {
              type: 'boolean',
              description:
                'Archive the entire recurring series. Only when the user explicitly asked for the whole series.',
            },
          },
          required: ['id'],
        },
      },
    },
    async execute(args: { id: string; bookingId?: string; allOccurrences?: boolean }) {
      if (args.allOccurrences) {
        await jobsService.delete(args.id, true)
        return { archived: true, id: args.id, scope: 'all-occurrences' }
      }
      if (args.bookingId) {
        await bookingsService.delete(args.bookingId)
        return { archived: true, id: args.id, bookingId: args.bookingId, scope: 'single-occurrence' }
      }
      // No occurrence specified. Safe only for non-recurring appointments: a recurring job's
      // occurrences all share the job id, and jobsService.delete(id) archives the ENTIRE series.
      const job: any = await jobsService.getById(args.id)
      if (job?.recurrenceId && (job?.occurrenceCount ?? 0) > 1) {
        return {
          error:
            'This is a recurring appointment with multiple occurrences. To delete ONE occurrence, pass its bookingId (from list_jobs). To delete the whole series, pass allOccurrences: true.',
          occurrenceCount: job.occurrenceCount,
        }
      }
      if (job?.bookingId) {
        // Archive just the appointment (booking); the job survives — same as the calendar UI.
        await bookingsService.delete(job.bookingId)
        return { archived: true, id: args.id, bookingId: job.bookingId, scope: 'single-occurrence' }
      }
      await jobsService.delete(args.id)
      return { archived: true, id: args.id, scope: 'job' }
    },
  },

  {
    name: 'delete_quote',
    mutates: true,
    destructive: true,
    affects: 'quotes',
    summarize: async a => `Delete ${await labelQuote(a?.id)} — this can’t be undone`,
    schema: {
      type: 'function',
      function: {
        name: 'delete_quote',
        description: 'Delete a quote. Destructive — find it with list_quotes first and confirm.',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      await quotesService.delete(args.id)
      return { deleted: true, id: args.id }
    },
  },

  {
    name: 'delete_invoice',
    mutates: true,
    destructive: true,
    affects: 'invoices',
    summarize: async a => `Delete ${await labelInvoice(a?.id)} — this can’t be undone`,
    schema: {
      type: 'function',
      function: {
        name: 'delete_invoice',
        description: 'Delete an invoice. Destructive — find it with list_invoices first and confirm.',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async execute(args: { id: string }) {
      await invoicesService.delete(args.id)
      return { deleted: true, id: args.id }
    },
  },
]

export const toolByName = new Map(agentTools.map(t => [t.name, t]))
export const toolSchemas = agentTools.map(t => t.schema)
