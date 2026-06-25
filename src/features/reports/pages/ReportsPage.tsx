import { useState, useEffect, useMemo } from 'react'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { useJobLogStore } from '@/features/jobLogs/store/jobLogStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
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
  subMonths,
  format,
} from 'date-fns'

type DateRangePreset = 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom'

export const ReportsPage = () => {
  const { user } = useAuthStore()
  const { jobLogs, fetchJobLogs, isLoading: jobLogsLoading } = useJobLogStore()
  const { quotes, fetchQuotes, isLoading: quotesLoading } = useQuoteStore()
  const { invoices, fetchInvoices, isLoading: invoicesLoading } = useInvoiceStore()

  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month')
  const now = new Date()
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(startOfMonth(now), 'yyyy-MM-dd')
  )
  const [customEndDate, setCustomEndDate] = useState<string>(format(endOfMonth(now), 'yyyy-MM-dd'))
  const [isTeamAccount, setIsTeamAccount] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
      case 'custom':
        start = customStartDate ? new Date(customStartDate) : startOfMonth(now)
        end = customEndDate ? new Date(customEndDate) : endOfMonth(now)
        break
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

        // Fetch job logs (includes time entries), quotes and invoices
        await fetchJobLogs()
        await fetchQuotes()
        await fetchInvoices()

        // Fetch all time entries (no jobLogId filter to get all entries)
        const entries = await services.timeEntries.getAll()
        setTimeEntries(entries)
      } catch (error) {
        console.error('Failed to load reports data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchJobLogs, fetchQuotes, fetchInvoices, user])

  const isLoading = jobLogsLoading || quotesLoading || invoicesLoading || loading

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
