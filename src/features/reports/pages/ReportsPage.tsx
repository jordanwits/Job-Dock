import { useState, useEffect, useMemo } from 'react'
import { Card, Button, Select } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { useJobLogStore } from '@/features/jobLogs/store/jobLogStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { EmployeeHoursReport } from '../components/EmployeeHoursReport'
import { QuotesReport } from '../components/QuotesReport'
import { InvoicesReport } from '../components/InvoicesReport'
import { JobsReport } from '../components/JobsReport'
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subDays,
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

        // Always fetch all users first - for team accounts show all, for single accounts we'll filter in the component
        // This ensures we have complete user data for any time entries
        const usersData = await services.users.getAll()
        console.log('Fetched users:', usersData.length, usersData)
        setUsers(usersData)

        // Fetch billing status to check if team account
        const billingStatus = await services.billing.getStatus()
        // Check both subscriptionTier and canInviteTeamMembers for team accounts
        // Also check if we have more than 1 user (fallback for team detection)
        const isTeam =
          billingStatus.subscriptionTier === 'team' ||
          billingStatus.canInviteTeamMembers === true ||
          usersData.length > 1
        setIsTeamAccount(isTeam)
        console.log('Billing status:', billingStatus)
        console.log(
          'Is team account:',
          isTeam,
          'subscriptionTier:',
          billingStatus.subscriptionTier,
          'canInviteTeamMembers:',
          billingStatus.canInviteTeamMembers,
          'userCount:',
          usersData.length
        )

        // Fetch job logs (includes time entries)
        await fetchJobLogs()

        // Fetch quotes and invoices
        await fetchQuotes()
        await fetchInvoices()

        // Fetch all time entries (no jobLogId filter to get all entries)
        const entries = await services.timeEntries.getAll()
        console.log('Fetched time entries:', entries.length)
        console.log('Time entries sample:', entries.slice(0, 3))
        console.log('Time entries with userId:', entries.filter(e => e.userId).length)
        console.log('Time entries userIds:', [
          ...new Set(entries.filter(e => e.userId).map(e => e.userId)),
        ])
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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-primary-light tracking-tight">
          <span className="text-primary-gold">Reports</span>
        </h1>
        <p className="text-sm md:text-base text-primary-light/60">
          View and export business reports for hours, quotes, invoices, and more
        </p>
      </div>

      {/* Date Range Selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-primary-light mb-2">Date Range</label>
            <Select
              value={dateRangePreset}
              onChange={e => setDateRangePreset(e.target.value as DateRangePreset)}
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
              <div className="flex-1">
                <label className="block text-sm font-medium text-primary-light mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-primary-blue/30 bg-primary-dark-secondary text-primary-light focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-primary-light mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-primary-blue/30 bg-primary-dark-secondary text-primary-light focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                />
              </div>
            </>
          )}
        </div>
        {dateRangePreset !== 'custom' && (
          <p className="text-sm text-primary-light/60 mt-3">
            {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}
          </p>
        )}
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <div className="h-6 w-48 bg-primary-dark rounded animate-pulse mb-4"></div>
              <div className="h-32 bg-primary-dark rounded animate-pulse"></div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Employee Hours Report */}
          <EmployeeHoursReport
            startDate={dateRange.start}
            endDate={dateRange.end}
            timeEntries={timeEntries}
            jobLogs={jobLogs}
            users={users}
            isTeamAccount={isTeamAccount}
          />

          {/* Quotes Report */}
          <QuotesReport startDate={dateRange.start} endDate={dateRange.end} quotes={quotes} />

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
