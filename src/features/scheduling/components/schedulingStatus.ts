import type { JobStatus } from '../types/job'

/** Semantic tone vocabulary shared across the scheduling (calendar) surface. */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

type JobStatusKey =
  | 'active'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'pending-confirmation'

/** Job/appointment status → display label + semantic tone. */
export const JOB_STATUS: Record<JobStatusKey, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  'in-progress': { label: 'In progress', tone: 'accent' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  'pending-confirmation': { label: 'Pending confirmation', tone: 'warning' },
}

/** Resolve any (possibly legacy/unknown) status string to a label + tone. */
export const resolveJobStatus = (status?: string | null): { label: string; tone: Tone } =>
  JOB_STATUS[(status as JobStatusKey)] ?? { label: status ? String(status) : 'Scheduled', tone: 'info' }

const JOB_STATUS_ORDER: JobStatusKey[] = [
  'scheduled',
  'in-progress',
  'completed',
  'pending-confirmation',
  'cancelled',
]

/** Options for an interactive StatusSelect on a job. */
export const JOB_STATUS_OPTIONS: { value: JobStatus; label: string; tone: Tone }[] =
  JOB_STATUS_ORDER.map(v => ({ value: v as JobStatus, label: JOB_STATUS[v].label, tone: JOB_STATUS[v].tone }))

/** Options for a list/calendar status filter (includes an "All" entry). */
export const JOB_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All status' },
  ...JOB_STATUS_ORDER.map(v => ({ value: v, label: JOB_STATUS[v].label })),
]

/** Service active/inactive → label + tone. */
export const serviceStatus = (isActive: boolean): { label: string; tone: Tone } =>
  isActive ? { label: 'Active', tone: 'success' } : { label: 'Inactive', tone: 'neutral' }

/** Soft fill + text + hairline classes for a calendar event chip, keyed by tone. */
export const eventToneCls: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-strong ring-1 ring-inset ring-accent/25',
  success: 'bg-success-soft text-success ring-1 ring-inset ring-success/25',
  warning: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/25',
  danger: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger/25',
  info: 'bg-info-soft text-info ring-1 ring-inset ring-info/25',
  neutral: 'bg-surface-2 text-ink-muted ring-1 ring-inset ring-line',
}
