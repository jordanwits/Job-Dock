import { useEffect, useMemo, useCallback, useRef, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useJobLogStore } from '@/features/jobLogs/store/jobLogStore'
import { useAuthStore } from '@/features/auth'
import { Card, Button } from '@/components/ui'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { getUpcomingBookingListInstant } from '@/features/scheduling/utils/upcomingBookingDisplay'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { QUOTE_STATUS_LABELS } from '@/features/quotes/types/quote'
import type { JobLog } from '@/features/jobLogs/types/jobLog'

const isStandaloneMode = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

function DashboardJobLogRow({ jobLog, theme }: { jobLog: JobLog; theme: 'dark' | 'light' }) {
  const totalMinutes =
    jobLog.timeEntries?.reduce((sum, te) => {
      const start = new Date(te.startTime).getTime()
      const end = new Date(te.endTime).getTime()
      const breakMin = te.breakMinutes ?? 0
      return sum + (end - start) / 60000 - breakMin
    }, 0) ?? 0
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.round(totalMinutes % 60)
  const statusLabel = (jobLog.status === 'archived' ? 'inactive' : jobLog.status) || 'active'
  const statusColors: Record<string, string> = {
    active:
      theme === 'dark'
        ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
        : 'bg-green-100 text-green-700 ring-1 ring-green-300',
    completed:
      theme === 'dark'
        ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
        : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
    inactive:
      theme === 'dark'
        ? 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20'
        : 'bg-gray-200 text-gray-600 ring-1 ring-gray-300',
  }
  return (
    <Link
      to={`/app/job-logs/${jobLog.id}`}
      className={cn(
        'block text-sm p-3 rounded-lg transition-all',
        theme === 'dark'
          ? 'bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10'
          : 'bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-200/30'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'font-medium truncate',
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}
        >
          {jobLog.title}
        </span>
        <span
          className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium capitalize whitespace-nowrap',
            statusColors[statusLabel] || statusColors.inactive
          )}
        >
          {statusLabel}
        </span>
      </div>
      <p
        className={cn(
          'text-xs mt-1.5',
          theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
        )}
      >
        {jobLog.timeEntries && jobLog.timeEntries.length > 0
          ? `${hours}h ${mins}m total`
          : format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
      </p>
    </Link>
  )
}

const DashboardPage = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, refreshAccessToken } = useAuthStore()
  const { theme } = useTheme()
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

    const promises: Promise<void>[] = [
      fetchJobs(startDate, endDate),
      fetchJobLogs(),
    ]
    if (!isEmployee) {
      promises.push(fetchQuotes())
      promises.push(fetchInvoices())
    }

    const results = await Promise.allSettled(promises)
    const allSucceeded = results.every((r) => r.status === 'fulfilled')
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
      const storesEmpty =
        storedJobLogs.length === 0 && storedJobs.length === 0

      // In PWA/standalone mode (e.g., iPhone home screen app), always force refresh
      // on visibility change since iOS can hold stale in-memory state after backgrounding.
      const shouldRefresh =
        forceRefresh ||
        isStale ||
        storesEmpty ||
        (isStandalone && reason === 'visibility')
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

  // Get upcoming appointments (next 7 days) - limit for compact display
  const upcomingJobsLimit = 5
  const upcomingJobs = useMemo(() => {
    const now = new Date()
    const nextWeek = addDays(now, 7)

    const entries: { job: (typeof jobs)[number]; displayAt: Date }[] = []
    for (const job of jobs) {
      if (!job.startTime) continue
      const displayAt = getUpcomingBookingListInstant(job, now)
      if (!displayAt || displayAt.getTime() > nextWeek.getTime()) continue
      entries.push({ job, displayAt })
    }

    return entries
      .sort((a, b) => a.displayAt.getTime() - b.displayAt.getTime())
      .slice(0, upcomingJobsLimit)
  }, [jobs, upcomingJobsLimit])

  // Quote metrics
  const quoteMetrics = useMemo(() => {
    const pending = quotes.filter(q => q.status === 'sent').length
    const accepted = quotes.filter(q => q.status === 'accepted').length
    const rejected = quotes.filter(q => q.status === 'rejected').length
    const draft = quotes.filter(q => q.status === 'draft').length

    // Recent quotes activity (last 3)
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
      .sort(
        (a, b) =>
          new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime()
      )
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
    const sent = invoices.filter(i => i.status === 'sent').length
    const overdue = invoices.filter(i => i.status === 'overdue').length
    const draft = invoices.filter(i => i.status === 'draft').length
    const clientApproved = invoices.filter(i => i.approvalStatus === 'accepted').length
    const awaitingApproval = invoices.filter(
      i => i.status === 'sent' && i.approvalStatus === 'none'
    ).length

    // Calculate total outstanding
    const outstanding = invoices
      .filter(i => i.paymentStatus !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
      .reduce((sum, i) => sum + (i.total - i.paidAmount), 0)

    // Recent sent/overdue invoices (last 3)
    const recentInvoices = invoices
      .filter(i => i.status === 'sent' || i.status === 'overdue')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)

    return { sent, overdue, draft, clientApproved, awaitingApproval, outstanding, recentInvoices }
  }, [invoices])

  const isLoading = isEmployee
    ? jobsLoading || jobLogsLoading
    : jobsLoading || jobLogsLoading || quotesLoading || invoicesLoading

  const statTileClass = (clickable: boolean) =>
    cn(
      'rounded-lg p-4 ring-1',
      theme === 'dark'
        ? 'bg-primary-dark/50 ring-white/5'
        : 'bg-gray-100 ring-gray-200/20',
      clickable
        ? theme === 'dark'
          ? 'cursor-pointer hover:bg-primary-dark hover:ring-1 hover:ring-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/40'
          : 'cursor-pointer hover:bg-gray-200 border border-transparent hover:border-gray-200/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50'
        : 'cursor-default'
    )

  const statTileProps = (clickable: boolean, path: string) =>
    clickable
      ? {
          role: 'button' as const,
          tabIndex: 0 as const,
          onClick: () => navigate(path),
          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navigate(path)
            }
          },
        }
      : {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className={cn(
          "text-3xl font-bold tracking-tight",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>
          Welcome back{user?.name ? <span className="text-primary-gold">, {user.name.split(' ')[0]}</span> : ''}
        </h1>
        <p className={cn(
          "text-base",
          theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
        )}>
          {isEmployee
            ? "Here's your schedule and upcoming appointments"
            : "Here's what's happening with your business today"}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skeleton cards */}
          <div className={cn(
            "lg:row-span-2 rounded-xl border p-6 shadow-sm",
            theme === 'dark'
              ? 'border-white/5 bg-primary-dark-secondary/50 shadow-black/20'
              : 'border-gray-200 bg-primary-lightSecondary shadow-gray-200/50'
          )}>
            <div className={cn(
              "h-6 w-48 rounded animate-pulse mb-6",
              theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
            )}></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={cn(
                  "h-20 rounded-lg animate-pulse",
                  theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
                )}></div>
              ))}
            </div>
          </div>
          <div className={cn(
            "rounded-xl border p-6 shadow-sm",
            theme === 'dark'
              ? 'border-white/5 bg-primary-dark-secondary/50 shadow-black/20'
              : 'border-gray-200 bg-primary-lightSecondary shadow-gray-200/50'
          )}>
            <div className={cn(
              "h-6 w-48 rounded animate-pulse mb-6",
              theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
            )}></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={cn(
                "h-20 rounded-lg animate-pulse",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
              )}></div>
              <div className={cn(
                "h-20 rounded-lg animate-pulse",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
              )}></div>
            </div>
          </div>
          <div className={cn(
            "rounded-xl border p-6 shadow-sm",
            theme === 'dark'
              ? 'border-white/5 bg-primary-dark-secondary/50 shadow-black/20'
              : 'border-gray-200 bg-primary-lightSecondary shadow-gray-200/50'
          )}>
            <div className={cn(
              "h-6 w-32 rounded animate-pulse mb-6",
              theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
            )}></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={cn(
                "h-20 rounded-lg animate-pulse",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
              )}></div>
              <div className={cn(
                "h-20 rounded-lg animate-pulse",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
              )}></div>
            </div>
          </div>
          <div className={cn(
            "rounded-xl border p-6 shadow-sm",
            theme === 'dark'
              ? 'border-white/5 bg-primary-dark-secondary/50 shadow-black/20'
              : 'border-gray-200 bg-primary-lightSecondary shadow-gray-200/50'
          )}>
            <div className={cn(
              "h-6 w-32 rounded animate-pulse mb-6",
              theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
            )}></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={cn(
                "h-20 rounded-lg animate-pulse",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
              )}></div>
              <div className={cn(
                "h-20 rounded-lg animate-pulse",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
              )}></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card>
            <div className={cn(
              "flex items-center justify-between pb-3 mb-4 border-b",
              theme === 'dark' ? 'border-white/5' : 'border-gray-200/20'
            )}>
              <h2 className={cn(
                "text-lg font-semibold tracking-tight",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>
                {isEmployee ? 'Your Upcoming Appointments' : 'Upcoming Appointments'}
              </h2>
              <Link to="/app/job-logs">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            {upcomingJobs.length === 0 ? (
              <div className="text-center py-6">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/40' : 'text-primary-lightTextSecondary'
                )}>
                  No upcoming appointments in the next 7 days
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingJobs.map(({ job, displayAt }) => {
                  const statusColors = {
                    active: theme === 'dark'
                      ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                      : 'bg-green-100 text-green-700 ring-1 ring-green-300',
                    scheduled: theme === 'dark'
                      ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                      : 'bg-green-100 text-green-700 ring-1 ring-green-300',
                    'in-progress': theme === 'dark'
                      ? 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20'
                      : 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',
                    completed: theme === 'dark'
                      ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                      : 'bg-green-100 text-green-700 ring-1 ring-green-300',
                    cancelled: theme === 'dark'
                      ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                      : 'bg-red-100 text-red-700 ring-1 ring-red-300',
                    'pending-confirmation': theme === 'dark'
                      ? 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20'
                      : 'bg-orange-100 text-orange-700 ring-1 ring-orange-300',
                  }

                  return (
                    <div
                      key={job.id}
                      onClick={() => navigate(`/app/job-logs/${job.id}`)}
                      className={cn(
                        "p-3 rounded-lg transition-all cursor-pointer",
                        theme === 'dark'
                          ? 'bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10'
                          : 'bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-200/30'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className={cn(
                            "font-medium truncate",
                            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                          )}>{job.title}</h3>
                          <p className={cn(
                            "text-sm mt-1.5",
                            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                          )}>
                            {format(displayAt, 'MMM d, yyyy • h:mm a')}
                          </p>
                          {job.contactName && (
                            <p className={cn(
                              "text-sm mt-1",
                              theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                            )}>{job.contactName}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                            statusColors[job.status]
                          )}
                        >
                          {job.status.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Jobs */}
          <Card>
            <div className={cn(
              "flex items-center justify-between pb-4 mb-5 border-b",
              theme === 'dark' ? 'border-white/5' : 'border-gray-200/20'
            )}>
              <h2 className={cn(
                "text-lg font-semibold tracking-tight",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>Jobs</h2>
              <Link to="/app/job-logs">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {/* Job Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div
                className={statTileClass(jobMetrics.activeCount > 0)}
                {...statTileProps(jobMetrics.activeCount > 0, '/app/job-logs?status=active')}
              >
                <p className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>
                  Active
                </p>
                <p className="text-2xl font-bold text-green-400 mt-2">{jobMetrics.activeCount}</p>
              </div>
              <div
                className={statTileClass(jobMetrics.completedCount > 0)}
                {...statTileProps(jobMetrics.completedCount > 0, '/app/job-logs?status=completed')}
              >
                <p className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>
                  Completed
                </p>
                <p className="text-2xl font-bold text-primary-blue mt-2">
                  {jobMetrics.completedCount}
                </p>
              </div>
            </div>

            {jobMetrics.pinnedJobs.length > 0 ? (
              <div className="mb-5">
                <p
                  className={cn(
                    'text-xs font-medium uppercase tracking-wide mb-3',
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}
                >
                  Pinned Jobs
                </p>
                <div className="space-y-2">
                  {jobMetrics.pinnedJobs.map(jobLog => (
                    <DashboardJobLogRow key={jobLog.id} jobLog={jobLog} theme={theme} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Recent Jobs */}
            {jobMetrics.recentJobs.length > 0 ? (
              <div>
                <p className={cn(
                  "text-xs font-medium uppercase tracking-wide mb-3",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>
                  Recent Jobs
                </p>
                <div className="space-y-2">
                  {jobMetrics.recentJobs.map(jobLog => (
                    <DashboardJobLogRow key={jobLog.id} jobLog={jobLog} theme={theme} />
                  ))}
                </div>
              </div>
            ) : jobMetrics.pinnedJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/40' : 'text-primary-lightTextSecondary'
                )}>No jobs yet</p>
                <Link to="/app/job-logs">
                  <Button variant="ghost" size="sm" className="mt-2">
                    Create Job
                  </Button>
                </Link>
              </div>
            ) : null}
          </Card>

          {/* Quotes - admin/owner only */}
          {!isEmployee && (
            <Card>
              <div className={cn(
                "flex items-center justify-between pb-4 mb-5 border-b",
                theme === 'dark' ? 'border-white/5' : 'border-gray-200/20'
              )}>
                <h2 className={cn(
                  "text-lg font-semibold tracking-tight",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>Quotes</h2>
                <Link to="/app/quotes">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              {/* Quote Stats */}
              <div
                className={cn(
                  'grid gap-3 mb-5 min-w-0',
                  quoteMetrics.rejected > 0 ? 'grid-cols-3' : 'grid-cols-2'
                )}
              >
                <div
                  className={cn(statTileClass(quoteMetrics.pending > 0), 'min-w-0')}
                  {...statTileProps(quoteMetrics.pending > 0, '/app/quotes?status=sent')}
                >
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>
                    Pending
                  </p>
                  <p className="text-2xl font-bold text-primary-blue mt-2">
                    {quoteMetrics.pending}
                  </p>
                </div>
                <div
                  className={cn(statTileClass(quoteMetrics.accepted > 0), 'min-w-0')}
                  {...statTileProps(quoteMetrics.accepted > 0, '/app/quotes?status=accepted')}
                >
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>
                    Accepted
                  </p>
                  <p className="text-2xl font-bold text-green-400 mt-2">{quoteMetrics.accepted}</p>
                </div>
                {quoteMetrics.rejected > 0 && (
                  <div
                    className={cn(statTileClass(true), 'min-w-0')}
                    {...statTileProps(true, '/app/quotes?status=rejected')}
                  >
                    <p className={cn(
                      "text-xs font-medium uppercase tracking-wide",
                      theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                    )}>
                      Declined
                    </p>
                    <p className="text-2xl font-bold text-red-400 mt-2">{quoteMetrics.rejected}</p>
                  </div>
                )}
              </div>

              {/* Recent Quotes */}
              {quoteMetrics.recentQuotes.length > 0 && (
                <div>
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide mb-3",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>
                    Recent Activity
                  </p>
                  <div className="space-y-2">
                    {quoteMetrics.recentQuotes.map(quote => (
                      <div
                        key={quote.id}
                        className={cn(
                          "text-sm p-3 rounded-lg transition-all",
                          theme === 'dark'
                            ? 'bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10'
                            : 'bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-200/30'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "font-medium truncate",
                            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                          )}>
                            {quote.quoteNumber}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-full font-medium',
                              quote.status === 'accepted' &&
                                (theme === 'dark'
                                  ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                                  : 'bg-green-100 text-green-700 ring-1 ring-green-300'),
                              quote.status === 'rejected' &&
                                (theme === 'dark'
                                  ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                                  : 'bg-red-100 text-red-700 ring-1 ring-red-300'),
                              quote.status === 'sent' &&
                                (theme === 'dark'
                                  ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                                  : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300')
                            )}
                          >
                            {QUOTE_STATUS_LABELS[quote.status]}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs mt-1.5",
                          theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                        )}>
                          ${quote.total.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Invoices Card - admin/owner only */}
          {!isEmployee && (
            <Card>
              <div className={cn(
                "flex items-center justify-between pb-4 mb-5 border-b",
                theme === 'dark' ? 'border-white/5' : 'border-gray-200/20'
              )}>
                <h2 className={cn(
                  "text-lg font-semibold tracking-tight",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  Invoices
                </h2>
                <Link to="/app/invoices">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              {/* Invoice Stats */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className={cn(
                  "rounded-lg p-4 ring-1",
                  theme === 'dark'
                    ? 'bg-primary-dark/50 ring-white/5'
                    : 'bg-gray-100 ring-gray-200/20'
                )}>
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>
                    Outstanding
                  </p>
                  <p className="text-2xl font-bold text-primary-gold mt-2">
                    ${invoiceMetrics.outstanding.toFixed(0)}
                  </p>
                </div>
                <div
                  className={statTileClass(invoiceMetrics.overdue > 0)}
                  {...statTileProps(invoiceMetrics.overdue > 0, '/app/invoices?status=overdue')}
                >
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>
                    Overdue
                  </p>
                  <p className="text-2xl font-bold text-red-400 mt-2">{invoiceMetrics.overdue}</p>
                </div>
              </div>

              {/* Client Approval Status */}
              <div className={cn(
                "rounded-lg p-4 mb-5 ring-1",
                theme === 'dark'
                  ? 'bg-primary-dark/50 ring-white/5'
                  : 'bg-gray-100 ring-gray-200/20'
              )}>
                <div className="flex items-center justify-between text-sm">
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>Client Approved</span>
                  <span className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>
                    {invoiceMetrics.clientApproved}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-3">
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>Awaiting Approval</span>
                  <span className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>
                    {invoiceMetrics.awaitingApproval}
                  </span>
                </div>
              </div>

              {/* Recent Invoices */}
              {invoiceMetrics.recentInvoices.length > 0 && (
                <div>
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide mb-3",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>
                    Recent Activity
                  </p>
                  <div className="space-y-2">
                    {invoiceMetrics.recentInvoices.map(invoice => (
                      <div
                        key={invoice.id}
                        className={cn(
                          "text-sm p-3 rounded-lg transition-all",
                          theme === 'dark'
                            ? 'bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10'
                            : 'bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-200/30'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "font-medium truncate",
                            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                          )}>
                            {invoice.invoiceNumber}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-full font-medium',
                              invoice.status === 'overdue' &&
                                (theme === 'dark'
                                  ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                                  : 'bg-red-100 text-red-700 ring-1 ring-red-300'),
                              invoice.status === 'sent' &&
                                (theme === 'dark'
                                  ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                                  : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300')
                            )}
                          >
                            {invoice.status}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs mt-1.5",
                          theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                        )}>
                          ${(invoice.total - invoice.paidAmount).toFixed(2)} due
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default DashboardPage
