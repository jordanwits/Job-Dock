import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useJobLogStore } from '@/features/jobLogs/store/jobLogStore'
import { useAuthStore } from '@/features/auth'
import { Card, Button } from '@/components/ui'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
const DashboardPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
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

  // Fetch all data function - memoized to avoid recreating on every render
  const fetchAllData = useCallback(() => {
    const now = new Date()
    const startDate = startOfMonth(now)
    const endDate = endOfMonth(addDays(now, 30)) // Fetch current and next month
    fetchJobs(startDate, endDate)
    fetchJobLogs()
    if (!isEmployee) {
      fetchQuotes()
      fetchInvoices()
    }
  }, [fetchJobs, fetchJobLogs, fetchQuotes, fetchInvoices, isEmployee])

  // Fetch all data on mount - force refresh to get updated overdue statuses
  // All users get appointments and job logs; admins also get quotes and invoices
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // Refetch data when page becomes visible again (handles mobile app idle time)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible again, refetch data to ensure it's fresh
        fetchAllData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchAllData])

  // Get upcoming appointments (next 7 days) - limit for compact display
  const upcomingJobsLimit = 5
  const upcomingJobs = useMemo(() => {
    const today = new Date()
    const nextWeek = addDays(today, 7)

    return jobs
      .filter(job => {
        const jobDate = new Date(job.startTime)
        return jobDate >= today && jobDate <= nextWeek && job.status !== 'cancelled'
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
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
    const recentJobs = [...jobLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
    return { activeCount: active.length, completedCount: completed.length, recentJobs }
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className={cn(
          "text-3xl font-bold tracking-tight",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>
          Welcome back{user?.name ? <span className="text-primary-gold">, {user.name}</span> : ''}
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
                {upcomingJobs.map(job => {
                  const statusColors = {
                    active: theme === 'dark'
                      ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                      : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
                    scheduled: theme === 'dark'
                      ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                      : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
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
                            {format(new Date(job.startTime), 'MMM d, yyyy • h:mm a')}
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
                  Active
                </p>
                <p className="text-2xl font-bold text-green-400 mt-2">{jobMetrics.activeCount}</p>
              </div>
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
                  Completed
                </p>
                <p className="text-2xl font-bold text-primary-blue mt-2">
                  {jobMetrics.completedCount}
                </p>
              </div>
            </div>

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
                  {jobMetrics.recentJobs.map(jobLog => {
                    const totalMinutes =
                      jobLog.timeEntries?.reduce((sum, te) => {
                        const start = new Date(te.startTime).getTime()
                        const end = new Date(te.endTime).getTime()
                        const breakMin = te.breakMinutes ?? 0
                        return sum + (end - start) / 60000 - breakMin
                      }, 0) ?? 0
                    const hours = Math.floor(totalMinutes / 60)
                    const mins = Math.round(totalMinutes % 60)
                    const statusLabel =
                      (jobLog.status === 'archived' ? 'inactive' : jobLog.status) || 'active'
                    const statusColors: Record<string, string> = {
                      active: theme === 'dark'
                        ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                        : 'bg-green-100 text-green-700 ring-1 ring-green-300',
                      completed: theme === 'dark'
                        ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                        : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
                      inactive:
                        theme === 'dark'
                          ? 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20'
                          : 'bg-gray-200 text-gray-600 ring-1 ring-gray-300',
                    }
                    return (
                      <Link
                        key={jobLog.id}
                        to={`/app/job-logs/${jobLog.id}`}
                        className={cn(
                          "block text-sm p-3 rounded-lg transition-all",
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
                        <p className={cn(
                          "text-xs mt-1.5",
                          theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                        )}>
                          {jobLog.timeEntries && jobLog.timeEntries.length > 0
                            ? `${hours}h ${mins}m total`
                            : format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
                        </p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : (
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
            )}
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
                    Pending
                  </p>
                  <p className="text-2xl font-bold text-primary-blue mt-2">
                    {quoteMetrics.pending}
                  </p>
                </div>
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
                    Accepted
                  </p>
                  <p className="text-2xl font-bold text-green-400 mt-2">{quoteMetrics.accepted}</p>
                </div>
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
                            {quote.status}
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
