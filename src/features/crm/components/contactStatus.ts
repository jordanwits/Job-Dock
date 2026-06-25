import type { ContactStatus } from '../types/contact'

/** Semantic tone vocabulary shared across the contacts (CRM) surface. */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Contact status → display label + semantic tone. */
export const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: Tone }> = {
  lead: { label: 'Lead', tone: 'info' },
  prospect: { label: 'Prospect', tone: 'warning' },
  customer: { label: 'Customer', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  contact: { label: 'Contact', tone: 'accent' },
}

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string; tone: Tone }[] = (
  ['lead', 'prospect', 'customer', 'inactive', 'contact'] as ContactStatus[]
).map(v => ({ value: v, label: CONTACT_STATUS[v].label, tone: CONTACT_STATUS[v].tone }))
