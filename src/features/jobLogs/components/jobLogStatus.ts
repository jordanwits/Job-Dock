/** Semantic tone vocabulary shared across the jobs (jobLogs) surface. */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export type JobLogStatus = 'active' | 'completed' | 'inactive'

/** Job status → display label + semantic tone. */
export const JOB_STATUS: Record<JobLogStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
}

const JOB_STATUS_ORDER: JobLogStatus[] = ['active', 'completed', 'inactive']

/** Options for the interactive StatusSelect on the detail view. */
export const JOB_STATUS_OPTIONS: { value: JobLogStatus; label: string; tone: Tone }[] =
  JOB_STATUS_ORDER.map(v => ({ value: v, label: JOB_STATUS[v].label, tone: JOB_STATUS[v].tone }))

/** Options for the list filter (includes an "All" entry). */
export const JOB_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All status' },
  ...JOB_STATUS_ORDER.map(v => ({ value: v, label: JOB_STATUS[v].label })),
]

/**
 * Booking/scheduling tone for the flattened booking status shown on cards
 * (scheduled vs to-be-scheduled vs completed). Kept separate from the job
 * lifecycle status above.
 */
export const bookingTone = (toBeScheduled?: boolean, startTime?: string | null): Tone => {
  if (toBeScheduled || !startTime) return 'warning'
  return 'info'
}
