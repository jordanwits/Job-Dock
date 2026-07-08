/**
 * Helpers for "staged monthly" recurring jobs.
 *
 * A staged monthly job has no fixed day: it lives as a single pending (toBeScheduled)
 * booking that re-rolls every month. `nextDueDate` is a virtual (non-DB) field used only
 * for the calendar chip label ("Monthly · Aug"). It is the first day of the month the
 * pending placeholder is currently "due" in.
 *
 * All math is done in UTC and the label is formatted in UTC on the frontend, so the month
 * never drifts across a timezone boundary.
 */

/**
 * First day (UTC midnight) of a month derived from `base`.
 * @param base    reference date (a scheduled occurrence's start, or the recurrence createdAt)
 * @param addMonth when true, advance one month past `base` (used for "month after latest scheduled")
 */
export function computeNextDueMonthISO(base: Date, addMonth: boolean): string {
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth() + (addMonth ? 1 : 0)
  // Date.UTC normalizes month overflow (e.g. month 12 -> January of next year).
  return new Date(Date.UTC(year, month, 1)).toISOString()
}
