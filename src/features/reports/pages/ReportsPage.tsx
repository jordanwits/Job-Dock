import { useState, useEffect, useMemo } from 'react'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import type { JobLog } from '@/features/jobLogs/types/jobLog'
import { EmployeeHoursReport } from '../components/EmployeeHoursReport'
import { QuotesReport } from '../components/QuotesReport'
import { InvoicesReport } from '../components/InvoicesReport'
import { JobsReport } from '../components/JobsReport'
import { Panel, SelectField, DateField } from '../components/reportsUi'
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  subMonths,
  format,
} from 'date-fns'

type DateRangePreset = 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom'

// Parse a 'yyyy-MM-dd' value as a LOCAL calendar date. `new Date('yyyy-MM-dd')`
// parses as UTC midnight, which in non-UTC timezones shifts the boundary into the
// adjacent day — silently dropping most of the chosen end day from custom ranges.
const parseLocalDate = (value: string): Date | null => {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? null : date
}

export const ReportsPage = () => {
  const { user } = useAuthStore()
  const { quotes, fetchQuotes, isLoading: quotesLoading, error: quotesError } = useQuoteStore()
  const {
    invoices,
    fetchInvoices,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useInvoiceStore()

  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month')
  const now = new Date()
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(startOfMonth(now), 'yyyy-MM-dd')
  )
  const [customEndDate, setCustomEndDate] = useState<string>(format(endOfMonth(now), 'yyyy-MM-dd'))
  const [isTeamAccount, setIsTeamAccount] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Calculate date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date()
    let start: Date
    let end: Date = endOfMonth(now)

    switch (dateRangePreset) {
      case 'this-month':
        start = startOfMonth(now)
        end = endOfMonth(now)
        break
      case 'last-month':
        const lastMonth = subMonths(now, 1)
        start = startOfMonth(lastMonth)
        end = endOfMonth(lastMonth)
        break
      case 'last-3-months':
        start = startOfMonth(subMonths(now, 2))
        end = endOfMonth(now)
        break
      case 'this-year':
        start = startOfYear(now)
        end = endOfYear(now)
        break
      case 'custom': {
        const parsedStart = customStartDate ? parseLocalDate(customStartDate) : null
        const parsedEnd = customEndDate ? parseLocalDate(customEndDate) : null
        // Inclusive of the whole local end day (00:00:00 → 23:59:59.999).
        start = parsedStart ? startOfDay(parsedStart) : startOfMonth(now)
        end = parsedEnd ? endOfDay(parsedEnd) : endOfMonth(now)
        break
      }
      default:
        start = startOfMonth(now)
        end = endOfMonth(now)
    }

    return { start, end }
  }, [dateRangePreset, customStartDate, customEndDate])

  // Fetch all data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setLoadError(null)

        // Always fetch all users first - for team accounts show all, for single
        // accounts we'll filter in the component. Ensures complete user data for
        // any time entries.
        const usersData = await services.users.getAll()
        setUsers(usersData)

        // Fetch billing status to check if team account
        const billingStatus = await services.billing.getStatus()
        const isTeam =
          billingStatus.subscriptionTier === 'team' ||
          billingStatus.subscriptionTier === 'team-plus' ||
          billingStatus.canInviteTeamMembers === true
        setIsTeamAccount(isTeam)

        // Fetch quotes and invoices via their stores
        await fetchQuotes()
        await fetchInvoices()

        // Fetch jobs WITH archived included so reports reflect completed/closed-out
        // work, not just the active book. Archived jobs are hidden on the Jobs page
        // but their revenue, labor cost, and per-employee pay still belong in reports.
        const jobs = await services.jobLogs.getAll({ includeArchived: true })
        setJobLogs(jobs)

        // Fetch all time entries (no jobLogId filter to get all entries)
        const entries = await services.timeEntries.getAll()
        setTimeEntries(entries)
      } catch (error) {
        console.error('Failed to load reports data:', error)
        setLoadError('Some report data failed to load.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchQuotes, fetchInvoices, user, reloadToken])

  const isLoading = quotesLoading || invoicesLoading || loading
  // Surface any failed fetch instead of rendering zeroed reports as fact.
  // The quote/invoice stores swallow fetch errors into their own error state.
  const loadFailed = !isLoading && (loadError || quotesError || invoicesError)

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Reports</h1>
        <p className="mt-1 text-sm text-ink-muted">
          View and export business reports for hours, quotes, invoices, and more
        </p>
      </div>

      {/* Date range selector */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="sm:max-w-xs sm:flex-1">
            <SelectField
              label="Date range"
              value={dateRangePreset}
              onChange={value => setDateRangePreset(value as DateRangePreset)}
              options={[
                { value: 'this-month', label: 'This Month' },
                { value: 'last-month', label: 'Last Month' },
                { value: 'last-3-months', label: 'Last 3 Months' },
                { value: 'this-year', label: 'This Year' },
                { value: 'custom', label: 'Custom Range' },
              ]}
            />
          </div>
          {dateRangePreset === 'custom' && (
            <>
              <div className="sm:flex-1">
                <DateField
                  label="Start date"
                  value={customStartDate}
                  onChange={setCustomStartDate}
                  maxDate={customEndDate}
                />
              </div>
              <div className="sm:flex-1">
                <DateField
                  label="End date"
                  value={customEndDate}
                  onChange={setCustomEndDate}
                  minDate={customStartDate}
                />
              </div>
            </>
          )}
        </div>
        <p className="mt-3 font-mono text-[13px] tabular-nums text-ink-subtle">
          {format(dateRange.start, 'MMM d, yyyy')} – {format(dateRange.end, 'MMM d, yyyy')}
        </p>
      </Panel>

      {/* Reports */}
      {isLoading ? (
        <div className="space-y-10">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="mb-3.5 h-4 w-40 animate-pulse rounded bg-surface-2" />
              <div className="h-40 animate-pulse rounded-xl bg-surface shadow-card" />
            </div>
          ))}
        </div>
      ) : loadFailed ? (
        <Panel className="p-5">
          <p className="text-sm font-medium text-danger">Couldn't load report data</p>
          <p className="mt-1 text-sm text-ink-muted">{loadError || quotesError || invoicesError}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Totals aren't shown because they would be incomplete.
          </p>
          <button
            type="button"
            onClick={() => setReloadToken(t => t + 1)}
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent-strong px-3 text-[13px] font-semibold text-accent-contrast transition-opacity hover:opacity-90"
          >
            Retry
          </button>
        </Panel>
      ) : (
        <div className="space-y-10">
          {/* Employee Hours Report - only for team accounts */}
          {isTeamAccount && (
            <EmployeeHoursReport
              startDate={dateRange.start}
              endDate={dateRange.end}
              timeEntries={timeEntries}
              jobLogs={jobLogs}
              users={users}
              isTeamAccount={isTeamAccount}
            />
          )}

          {/* Quotes Report */}
          <QuotesReport startDate={dateRange.start} endDate={dateRange.end} quotes={quotes} invoices={invoices} />

          {/* Invoices Report */}
          <InvoicesReport startDate={dateRange.start} endDate={dateRange.end} invoices={invoices} />

          {/* Jobs Report */}
          <JobsReport
            startDate={dateRange.start}
            endDate={dateRange.end}
            jobLogs={jobLogs}
            invoices={invoices}
            timeEntries={timeEntries}
          />
        </div>
      )}
    </div>
  )
}
