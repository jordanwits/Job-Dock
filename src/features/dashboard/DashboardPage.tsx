import { useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useJobLogStore } from '@/features/jobLogs/store/jobLogStore'
import { useAuthStore } from '@/features/auth'
import { format, startOfMonth, endOfMonth, addDays, isSameDay } from 'date-fns'
import { getUpcomingBookingListInstant } from '@/features/scheduling/utils/upcomingBookingDisplay'
import { formatHoursMinutes } from '@/lib/utils'
import type { JobLog } from '@/features/jobLogs/types/jobLog'
import {
  HeroMetric,
  KpiStrip,
  KpiItem,
  SectionHeader,
  Panel,
  StatSplit,
  ProgressBar,
  Dot,
  StatusPill,
  EmptyState,
  CalendarIcon,
  BriefcaseIcon,
  DocumentIcon,
  ReceiptIcon,
  PlusIcon,
  type Tone,
} from './components/DashboardWidgets'

const isStandaloneMode = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

// CTA button styled on design tokens (shared ui/Button left untouched for now).
const accentButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3.5 py-2 text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Status → semantic tone.
const apptTone = (status: string): Tone => {
  switch (status) {
    case 'in-progress':
    case 'pending-confirmation':
      return 'warning'
    case 'cancelled':
      return 'danger'
    case 'completed':
      return 'success'
    default:
      return 'info' // active, scheduled
  }
}
const apptLabel = (status: string): string =>
  status === 'pending-confirmation' ? 'unconfirmed' : status.replace('-', ' ')

const jobLogTone = (label: string): Tone =>
  label === 'active' ? 'success' : label === 'completed' ? 'info' : 'neutral'

const quoteTone = (status: string): Tone => {
  switch (status) {
    case 'accepted':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'sent':
      return 'info'
    default:
      return 'neutral'
  }
}

// Routine states get a quiet dot; urgency (danger) gets a filled pill.
function ApptStatus({ status }: { status: string }) {
  const tone = apptTone(status)
  const label = apptLabel(status)
  if (tone === 'danger') return <StatusPill tone="danger">{label}</StatusPill>
  return (
    <span className="flex shrink-0 items-center gap-2 text-[13px] text-ink-muted">
      <Dot tone={tone} />
      <span className="hidden capitalize sm:inline">{label}</span>
    </span>
  )
}

function JobRow({ jobLog }: { jobLog: JobLog }) {
  const totalMinutes =
    jobLog.timeEntries?.reduce((sum, te) => {
      const start = new Date(te.startTime).getTime()
      const end = new Date(te.endTime).getTime()
      const breakMin = te.breakMinutes ?? 0
      return sum + (end - start) / 60000 - breakMin
    }, 0) ?? 0
  const { hours, minutes: mins } = formatHoursMinutes(totalMinutes / 60)
  // `archived` can appear at runtime even though it's not in the status union.
  const rawStatus = jobLog.status as string
  const statusLabel = (rawStatus === 'archived' ? 'inactive' : rawStatus) || 'active'
  const meta =
    jobLog.timeEntries && jobLog.timeEntries.length > 0
      ? `${hours}h ${mins}m`
      : format(new Date(jobLog.createdAt), 'MMM d')

  return (
    <Link
      to={`/app/job-logs/${jobLog.id}`}
      className="flex items-center justify-between gap-3 rounded-sm py-2.5 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="truncate text-[15px] text-ink">{jobLog.title}</span>
      <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
        <Dot tone={jobLogTone(statusLabel)} />
        <span className="font-mono tabular-nums">{meta}</span>
      </span>
    </Link>
  )
}

const DashboardPage = () => {
  const { user, isAuthenticated, refreshAccessToken } = useAuthStore()
  const { jobs, fetchJobs, isLoading: jobsLoading } = useJobStore()
  const { quotes, fetchQuotes, isLoading: quotesLoading } = useQuoteStore()
  const { invoices, fetchInvoices, isLoading: invoicesLoading } = useInvoiceStore()
  const { jobLogs, fetchJobLogs, isLoading: jobLogsLoading } = useJobLogStore()

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const isEmployee = user?.role === 'employee'
  const lastFetchAtRef = useRef<number>(0)
  const inFlightRef = useRef<boolean>(false)
  const STALE_AFTER_MS = 2 * 60 * 1000
  const isStandalone = isStandaloneMode()

  // Fetch all data function - memoized to avoid recreating on every render.
  // Returns true if all fetches succeeded; only then do we mark data fresh.
  const fetchAllData = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user) return false
    const now = new Date()
    const startDate = startOfMonth(now)
    const endDate = endOfMonth(addDays(now, 30)) // Fetch current and next month

    const promises: Promise<void>[] = [fetchJobs(startDate, endDate), fetchJobLogs()]
    if (!isEmployee) {
      promises.push(fetchQuotes())
      promises.push(fetchInvoices())
    }

    const results = await Promise.allSettled(promises)
    const allSucceeded = results.every(r => r.status === 'fulfilled')
    if (allSucceeded) {
      lastFetchAtRef.current = Date.now()
    }
    return allSucceeded
  }, [fetchJobs, fetchJobLogs, fetchQuotes, fetchInvoices, isEmployee, isAuthenticated, user])

  // Fetch all data on mount - force refresh to get updated overdue statuses
  // All users get appointments and job logs; admins also get quotes and invoices
  useEffect(() => {
    void fetchAllData()
  }, [fetchAllData])

  const refreshAndFetchIfStale = useCallback(
    async (reason: 'visibility' | 'focus' | 'pageshow', forceRefresh = false) => {
      if (!isAuthenticated || !user) return
      if (inFlightRef.current) return

      const last = lastFetchAtRef.current
      const now = Date.now()
      const isStale = !last || now - last >= STALE_AFTER_MS

      // After resume, stores may be empty if iOS cleared in-memory state; treat as stale.
      const { jobLogs: storedJobLogs } = useJobLogStore.getState()
      const { jobs: storedJobs } = useJobStore.getState()
      const storesEmpty = storedJobLogs.length === 0 && storedJobs.length === 0

      // In PWA/standalone mode (e.g., iPhone home screen app), always force refresh
      // on visibility change since iOS can hold stale in-memory state after backgrounding.
      const shouldRefresh =
        forceRefresh || isStale || storesEmpty || (isStandalone && reason === 'visibility')
      if (!shouldRefresh) return

      inFlightRef.current = true
      try {
        // After long idle, the access token may be expired; refresh first so fetches succeed.
        try {
          await refreshAccessToken()
        } catch {
          // If refresh fails, auth store clears session / redirects elsewhere.
        }

        // Only fetch if we're still authenticated after attempting refresh.
        if (useAuthStore.getState().isAuthenticated) {
          await fetchAllData()
        }
      } finally {
        inFlightRef.current = false
      }
    },
    [fetchAllData, isAuthenticated, refreshAccessToken, user, isStandalone]
  )

  // Refetch data when page becomes visible/focused again (handles mobile app idle time)
  useEffect(() => {
    let followUpTimeoutId: ReturnType<typeof setTimeout> | null = null

    const scheduleDelayedRefetch = (reason: 'visibility' | 'pageshow') => {
      if (!isStandalone) return
      if (followUpTimeoutId) clearTimeout(followUpTimeoutId)
      followUpTimeoutId = setTimeout(() => {
        followUpTimeoutId = null
        if (document.visibilityState === 'visible') {
          void refreshAndFetchIfStale(reason, true)
        }
      }, 1500)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force refresh in standalone/PWA mode to handle iOS backgrounding behavior
        void refreshAndFetchIfStale('visibility', isStandalone)
        scheduleDelayedRefetch('visibility')
      }
    }

    const handleFocus = () => {
      void refreshAndFetchIfStale('focus')
    }

    const handlePageShow = (e: PageTransitionEvent) => {
      // `pageshow` covers bfcache restores in some environments.
      // Force refresh when page is restored from bfcache (e.persisted)
      if (e.persisted || document.visibilityState === 'visible') {
        void refreshAndFetchIfStale('pageshow', e.persisted || isStandalone)
        if (e.persisted || isStandalone) {
          scheduleDelayedRefetch('pageshow')
        }
      }
    }

    // iOS-specific: handle resume from app switcher / background
    const handleResume = () => {
      void refreshAndFetchIfStale('visibility', true)
      scheduleDelayedRefetch('visibility')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)
    // 'resume' event is dispatched by some PWA environments when app resumes
    window.addEventListener('resume', handleResume)

    return () => {
      if (followUpTimeoutId) clearTimeout(followUpTimeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('resume', handleResume)
    }
  }, [refreshAndFetchIfStale, isStandalone])

  // Upcoming appointments (next 7 days) — full window for counts, sliced for display.
  const upcoming = useMemo(() => {
    const now = new Date()
    const nextWeek = addDays(now, 7)

    const entries: { job: (typeof jobs)[number]; displayAt: Date }[] = []
    for (const job of jobs) {
      if (!job.startTime) continue
      const displayAt = getUpcomingBookingListInstant(job, now)
      if (!displayAt || displayAt.getTime() > nextWeek.getTime()) continue
      entries.push({ job, displayAt })
    }

    entries.sort((a, b) => a.displayAt.getTime() - b.displayAt.getTime())
    const todayCount = entries.filter(e => isSameDay(e.displayAt, now)).length
    return { list: entries.slice(0, 5), count: entries.length, todayCount }
  }, [jobs])

  // Quote metrics
  const quoteMetrics = useMemo(() => {
    const pending = quotes.filter(q => q.status === 'sent').length
    const accepted = quotes.filter(q => q.status === 'accepted').length
    const rejected = quotes.filter(q => q.status === 'rejected').length
    const draft = quotes.filter(q => q.status === 'draft').length

    const recentQuotes = quotes
      .filter(q => q.status === 'sent' || q.status === 'accepted' || q.status === 'rejected')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)

    return { pending, accepted, rejected, draft, recentQuotes }
  }, [quotes])

  // Job (job log) metrics - for all users
  const jobMetrics = useMemo(() => {
    const norm = (s: string | undefined) => (s === 'archived' ? 'inactive' : s || 'active')
    const active = jobLogs.filter(j => norm(j.status) === 'active')
    const completed = jobLogs.filter(j => norm(j.status) === 'completed')
    const pinnedJobs = [...jobLogs]
      .filter(j => Boolean(j.pinnedAt))
      .sort((a, b) => new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime())
    const pinnedIds = new Set(pinnedJobs.map(j => j.id))
    const recentJobs = [...jobLogs]
      .filter(j => !pinnedIds.has(j.id))
      .sort((a, b) => {
        const aActive = norm(a.status) === 'active'
        const bActive = norm(b.status) === 'active'
        if (aActive && !bActive) return -1
        if (!aActive && bActive) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      .slice(0, 5)
    return {
      activeCount: active.length,
      completedCount: completed.length,
      pinnedJobs,
      recentJobs,
    }
  }, [jobLogs])

  // Invoice metrics
  const invoiceMetrics = useMemo(() => {
    const overdue = invoices.filter(i => i.status === 'overdue').length
    const paid = invoices.filter(i => i.paymentStatus === 'paid').length
    const unpaid = invoices.filter(
      i => i.paymentStatus !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'
    ).length

    const isOutstanding = (i: (typeof invoices)[number]) =>
      i.paymentStatus !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'

    const outstanding = invoices
      .filter(isOutstanding)
      .reduce((sum, i) => sum + (i.total - i.paidAmount), 0)
    const overdueAmount = invoices
      .filter(i => i.status === 'overdue')
      .reduce((sum, i) => sum + (i.total - i.paidAmount), 0)

    return { overdue, paid, unpaid, outstanding, overdueAmount }
  }, [invoices])

  const isLoading = isEmployee
    ? jobsLoading || jobLogsLoading
    : jobsLoading || jobLogsLoading || quotesLoading || invoicesLoading

  const firstName = user?.name?.split(' ')[0]
  const paidTotal = invoiceMetrics.paid + invoiceMetrics.unpaid
  const paidPct = paidTotal > 0 ? Math.round((invoiceMetrics.paid / paidTotal) * 100) : 0
  const combinedJobs = [...jobMetrics.pinnedJobs, ...jobMetrics.recentJobs].slice(0, 4)

  // ── Zone 1: greeting + hero metric ───────────────────────────────────────
  const heroMetric = isEmployee ? (
    <HeroMetric
      label="This week"
      amount={upcoming.count}
      format={n => String(Math.round(n))}
      caption={
        upcoming.count === 0 ? (
          'No appointments scheduled in the next 7 days.'
        ) : (
          <>
            {upcoming.todayCount} today · {jobMetrics.activeCount} active{' '}
            {jobMetrics.activeCount === 1 ? 'job' : 'jobs'}
          </>
        )
      }
    />
  ) : (
    <HeroMetric
      label="Outstanding"
      amount={invoiceMetrics.outstanding}
      format={money}
      caption={
        invoiceMetrics.outstanding === 0 ? (
          "You're all caught up — every invoice is paid."
        ) : (
          <>
            across {invoiceMetrics.unpaid} unpaid{' '}
            {invoiceMetrics.unpaid === 1 ? 'invoice' : 'invoices'}
            {invoiceMetrics.overdue > 0 && (
              <>
                {' · '}
                <span className="font-medium text-danger">{invoiceMetrics.overdue} overdue</span>
                {' worth '}
                <span className="font-mono tabular-nums">{money(invoiceMetrics.overdueAmount)}</span>
              </>
            )}
          </>
        )
      }
    />
  )

  // ── Zone 2: secondary KPI strip ──────────────────────────────────────────
  const kpiStrip = isEmployee ? (
    <KpiStrip className="max-w-xl">
      <KpiItem index={0} label="Today" value={upcoming.todayCount} caption="appointments" to="/app/job-logs" />
      <KpiItem index={1} label="Active jobs" value={jobMetrics.activeCount} caption="in progress" to="/app/job-logs?status=active" />
      <KpiItem index={2} label="Completed" value={jobMetrics.completedCount} caption="to date" to="/app/job-logs?status=completed" />
    </KpiStrip>
  ) : (
    <KpiStrip className="max-w-xl">
      <KpiItem index={0} label="This week" value={upcoming.count} caption="appointments" to="/app/job-logs" />
      <KpiItem index={1} label="Active jobs" value={jobMetrics.activeCount} caption="in progress" to="/app/job-logs?status=active" />
      <KpiItem index={2} label="Pending quotes" value={quoteMetrics.pending} caption="awaiting reply" to="/app/quotes?status=sent" />
    </KpiStrip>
  )

  // ── Zone 3: contained lists ──────────────────────────────────────────────
  const appointmentsSection = (
    <section>
      <SectionHeader
        title={isEmployee ? 'Your appointments' : 'Upcoming appointments'}
        viewAllHref="/app/job-logs"
        viewAllLabel="View schedule"
      />
      {upcoming.list.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title="No appointments in the next 7 days. Your schedule is clear."
            action={
              <Link to="/app/scheduling" className={accentButtonClass}>
                <PlusIcon className="h-4 w-4" />
                Schedule a job
              </Link>
            }
          />
        </Panel>
      ) : (
        <Panel className="px-5 sm:px-6">
          <div className="divide-y divide-line">
            {upcoming.list.map(({ job, displayAt }) => (
              <Link
                key={job.id}
                to={`/app/job-logs/${job.id}`}
                className="flex items-center gap-4 rounded-sm py-3.5 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="w-9 shrink-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                    {format(displayAt, 'EEE')}
                  </p>
                  <p className="font-mono text-lg font-semibold leading-none text-ink">
                    {format(displayAt, 'd')}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{job.title}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {format(displayAt, 'h:mm a')}
                    {job.contactName ? ` · ${job.contactName}` : ''}
                  </p>
                </div>
                <ApptStatus status={job.status} />
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </section>
  )

  const jobsSection = (
    <section className={isEmployee ? 'max-w-md' : ''}>
      <SectionHeader title="Jobs" viewAllHref="/app/job-logs" />
      <Panel className="p-5">
        {jobLogs.length === 0 ? (
          <EmptyState
            icon={<BriefcaseIcon className="h-6 w-6" />}
            title="No jobs yet. Create one to track time and before/after photos."
            action={
              <Link to="/app/job-logs" className={accentButtonClass}>
                <PlusIcon className="h-4 w-4" />
                Create job
              </Link>
            }
          />
        ) : (
          <>
            <StatSplit
              items={[
                { value: jobMetrics.activeCount, label: 'Active' },
                { value: jobMetrics.completedCount, label: 'Completed' },
              ]}
            />
            {combinedJobs.length > 0 && (
              <div className="mt-4 divide-y divide-line border-t border-line">
                {combinedJobs.map(jobLog => (
                  <JobRow key={jobLog.id} jobLog={jobLog} />
                ))}
              </div>
            )}
          </>
        )}
      </Panel>
    </section>
  )

  const quotesSection = (
    <section>
      <SectionHeader title="Quotes" viewAllHref="/app/quotes" />
      <Panel className="p-5">
        {quotes.length === 0 ? (
          <EmptyState
            icon={<DocumentIcon className="h-6 w-6" />}
            title="No quotes yet. Send one to win your next job."
            action={
              <Link to="/app/quotes" className={accentButtonClass}>
                <PlusIcon className="h-4 w-4" />
                New quote
              </Link>
            }
          />
        ) : (
          <>
            <StatSplit
              items={
                quoteMetrics.rejected > 0
                  ? [
                      { value: quoteMetrics.pending, label: 'Pending' },
                      { value: quoteMetrics.accepted, label: 'Accepted' },
                      { value: quoteMetrics.rejected, label: 'Declined', tone: 'danger' },
                    ]
                  : [
                      { value: quoteMetrics.pending, label: 'Pending' },
                      { value: quoteMetrics.accepted, label: 'Accepted' },
                    ]
              }
            />
            {quoteMetrics.recentQuotes.length > 0 && (
              <div className="mt-4 divide-y divide-line border-t border-line">
                {quoteMetrics.recentQuotes.map(quote => (
                  <div key={quote.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate text-[15px] text-ink">{quote.quoteNumber}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                      <Dot tone={quoteTone(quote.status)} />
                      <span className="font-mono tabular-nums">${quote.total.toFixed(0)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Panel>
    </section>
  )

  const invoicesSection = (
    <section>
      <SectionHeader title="Invoices" viewAllHref="/app/invoices" />
      <Panel className="p-5">
        {invoices.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon className="h-6 w-6" />}
            title="No invoices yet. Send one to get paid by card or ACH."
            action={
              <Link to="/app/invoices" className={accentButtonClass}>
                <PlusIcon className="h-4 w-4" />
                New invoice
              </Link>
            }
          />
        ) : (
          <>
            <StatSplit
              items={[
                { value: money(invoiceMetrics.outstanding), label: 'Outstanding', tone: 'accent' },
                {
                  value: invoiceMetrics.overdue,
                  label: 'Overdue',
                  tone: invoiceMetrics.overdue > 0 ? 'danger' : 'ink',
                },
              ]}
            />
            {paidTotal > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-ink-muted">Paid this month</span>
                  <span className="font-mono font-medium tabular-nums text-ink">
                    {invoiceMetrics.paid} / {paidTotal}
                  </span>
                </div>
                <div className="mt-2.5">
                  <ProgressBar value={paidPct} />
                </div>
              </div>
            )}
          </>
        )}
      </Panel>
    </section>
  )

  // ── Skeleton ──────────────────────────────────────────────────────────────
  const skeleton = (
    <>
      <div className="mt-7 space-y-3.5">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
        <div className="h-14 w-52 animate-pulse rounded-lg bg-surface-2 sm:h-16" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface-2" />
      </div>
      <div className="mt-11 grid max-w-xl grid-cols-3 gap-5">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-2.5">
            <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
            <div className="h-7 w-10 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="mt-14 space-y-12">
        <div>
          <div className="mb-3.5 h-4 w-44 animate-pulse rounded bg-surface-2" />
          <div className="h-52 animate-pulse rounded-xl bg-surface shadow-card" />
        </div>
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i}>
              <div className="mb-3.5 h-4 w-24 animate-pulse rounded bg-surface-2" />
              <div className="h-40 animate-pulse rounded-xl bg-surface shadow-card" />
            </div>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <div className="mx-auto max-w-5xl">
      {/* Zone 1 — greeting (always shown) */}
      <div>
        <p className="text-sm text-ink-muted">{format(new Date(), 'EEEE, MMMM d')}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Welcome back{firstName ? <>, {firstName}</> : ''}
        </h1>
      </div>

      {isLoading ? (
        skeleton
      ) : (
        <>
          <div className="mt-7">{heroMetric}</div>
          <div className="mt-11">{kpiStrip}</div>

          <div className="mt-14 space-y-12">
            {appointmentsSection}
            {isEmployee ? (
              jobsSection
            ) : (
              <div className="grid gap-x-8 gap-y-10 md:grid-cols-3">
                {jobsSection}
                {quotesSection}
                {invoicesSection}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DashboardPage
