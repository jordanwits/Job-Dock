import type { QuoteStatus } from '../types/quote'

/** Semantic tone vocabulary shared across the quotes surface (mirrors the CRM tone set). */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/**
 * Quote status → display label + semantic tone.
 *
 * `rejected` reads as "Declined" to the user (the API/stored value stays
 * `rejected`). Declined + expired are the quiet "needs attention" states.
 */
export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'warning' },
}

const QUOTE_STATUS_ORDER: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired']

/** Status options for the interactive StatusSelect on the detail view. */
export const QUOTE_STATUS_OPTIONS: { value: QuoteStatus; label: string; tone: Tone }[] =
  QUOTE_STATUS_ORDER.map(v => ({ value: v, label: QUOTE_STATUS[v].label, tone: QUOTE_STATUS[v].tone }))

/** Status options for the list filter (includes an "All" entry). */
export const QUOTE_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All status' },
  ...QUOTE_STATUS_ORDER.map(v => ({ value: v, label: QUOTE_STATUS[v].label })),
]
