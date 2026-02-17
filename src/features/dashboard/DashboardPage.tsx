import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useJobLogStore } from '@/features/jobLogs/store/jobLogStore'
import { useAuthStore } from '@/features/auth'
import { Card, Button } from '@/components/ui'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { cn } from '@/lib/utils'
const DashboardPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { jobs, fetchJobs, isLoading: jobsLoading } = useJobStore()
  const { quotes, fetchQuotes, isLoading: quotesLoading } = useQuoteStore()
  const { invoices, fetchInvoices, isLoading: invoicesLoading } = useInvoiceStore()
  const { jobLogs, fetchJobLogs, isLoading: jobLogsLoading } = useJobLogStore()
  

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const isEmployee = user?.role === 'employee'

  // Fetch all data on mount - force refresh to get updated overdue statuses
  // All users get appointments and job logs; admins also get quotes and invoices
  useEffect(() => {
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

  // Get upcoming appointments (next 7 days) - limit for compact display
  const upcomingJobsLimit = 5
  const upcomingJobs = useMemo(() => {
    const today = new Date()
    const nextWeek = addDays(today, 7)

    return jobs
      .filter((job) => {
        const jobDate = new Date(job.startTime)
        return jobDate >= today && jobDate <= nextWeek && job.status !== 'cancelled'
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, upcomingJobsLimit)
  }, [jobs, upcomingJobsLimit])

  // Quote metrics
  const quoteMetrics = useMemo(() => {
    const pending = quotes.filter((q) => q.status === 'sent').length
    const accepted = quotes.filter((q) => q.status === 'accepted').length
    const rejected = quotes.filter((q) => q.status === 'rejected').length
    const draft = quotes.filter((q) => q.status === 'draft').length

    // Recent quotes activity (last 3)
    const recentQuotes = quotes
      .filter((q) => q.status === 'sent' || q.status === 'accepted' || q.status === 'rejected')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)

    return { pending, accepted, rejected, draft, recentQuotes }
  }, [quotes])

  // Job (job log) metrics - for all users
  const jobMetrics = useMemo(() => {
    const norm = (s: string | undefined) => (s === 'archived' ? 'inactive' : s || 'active')
    const active = jobLogs.filter((j) => norm(j.status) === 'active')
    const completed = jobLogs.filter((j) => norm(j.status) === 'completed')
    const recentJobs = [...jobLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
    return { activeCount: active.length, completedCount: completed.length, recentJobs }
  }, [jobLogs])

  // Invoice metrics
  const invoiceMetrics = useMemo(() => {
    const sent = invoices.filter((i) => i.status === 'sent').length
    const overdue = invoices.filter((i) => i.status === 'overdue').length
    const draft = invoices.filter((i) => i.status === 'draft').length
    const clientApproved = invoices.filter((i) => i.approvalStatus === 'accepted').length
    const awaitingApproval = invoices.filter(
      (i) => i.status === 'sent' && i.approvalStatus === 'none'
    ).length

    // Calculate total outstanding
    const outstanding = invoices
      .filter((i) => i.paymentStatus !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
      .reduce((sum, i) => sum + (i.total - i.paidAmount), 0)

    // Recent sent/overdue invoices (last 3)
    const recentInvoices = invoices
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
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
        <h1 className="text-3xl font-bold text-primary-light tracking-tight">
          Welcome back{user?.name ? <span className="text-primary-gold">, {user.name}</span> : ''}
        </h1>
        <p className="text-primary-light/60 text-base">
          {isEmployee
            ? "Here's your schedule and upcoming appointments"
            : "Here's what's happening with your business today"}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skeleton cards */}
          <div className="lg:row-span-2 rounded-xl border border-white/5 bg-primary-dark-secondary/50 p-6 shadow-sm shadow-black/20">
            <div className="h-6 w-48 bg-primary-dark rounded animate-pulse mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-primary-dark-secondary/50 p-6 shadow-sm shadow-black/20">
            <div className="h-6 w-48 bg-primary-dark rounded animate-pulse mb-6"></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
              <div className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-primary-dark-secondary/50 p-6 shadow-sm shadow-black/20">
            <div className="h-6 w-32 bg-primary-dark rounded animate-pulse mb-6"></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
              <div className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-primary-dark-secondary/50 p-6 shadow-sm shadow-black/20">
            <div className="h-6 w-32 bg-primary-dark rounded animate-pulse mb-6"></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
              <div className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className="rounded-xl border-white/10 shadow-sm shadow-black/20 p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-primary-light tracking-tight">
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
                <p className="text-primary-light/40 text-sm">
                  No upcoming appointments in the next 7 days
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingJobs.map((job) => {
                  const statusColors = {
                    active: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
                    scheduled: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
                    'in-progress': 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20',
                    completed: 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20',
                    cancelled: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
                    'pending-confirmation': 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20',
                  }

                  return (
                    <div
                      key={job.id}
                      onClick={() => navigate(`/app/job-logs/${job.id}`)}
                      className="p-3 rounded-lg bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-primary-light truncate">{job.title}</h3>
                          <p className="text-sm text-primary-light/60 mt-1.5">
                            {format(new Date(job.startTime), 'MMM d, yyyy • h:mm a')}
                          </p>
                          {job.contactName && (
                            <p className="text-sm text-primary-light/50 mt-1">{job.contactName}</p>
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
          <Card className="rounded-xl border-white/10 shadow-sm shadow-black/20 p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-primary-light tracking-tight">Jobs</h2>
              <Link to="/app/job-logs">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {/* Job Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-primary-dark/50 rounded-lg p-4 ring-1 ring-white/5">
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold text-green-400 mt-2">{jobMetrics.activeCount}</p>
              </div>
              <div className="bg-primary-dark/50 rounded-lg p-4 ring-1 ring-white/5">
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold text-primary-blue mt-2">{jobMetrics.completedCount}</p>
              </div>
            </div>

            {/* Recent Jobs */}
            {jobMetrics.recentJobs.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide mb-3">Recent Jobs</p>
                <div className="space-y-2">
                  {jobMetrics.recentJobs.map((jobLog) => {
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
                      active: 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20',
                      completed: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
                      inactive: 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20',
                    }
                    return (
                      <Link
                        key={jobLog.id}
                        to={`/app/job-logs/${jobLog.id}`}
                        className="block text-sm p-3 rounded-lg bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-primary-light font-medium truncate">{jobLog.title}</span>
                          <span
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-full font-medium capitalize whitespace-nowrap',
                              statusColors[statusLabel] || statusColors.inactive
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-primary-light/50 text-xs mt-1.5">
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
                <p className="text-primary-light/40 text-sm">No jobs yet</p>
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
          <Card className="rounded-xl border-white/10 shadow-sm shadow-black/20 p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-primary-light tracking-tight">Quotes</h2>
              <Link to="/app/quotes">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {/* Quote Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-primary-dark/50 rounded-lg p-4 ring-1 ring-white/5">
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold text-primary-blue mt-2">{quoteMetrics.pending}</p>
              </div>
              <div className="bg-primary-dark/50 rounded-lg p-4 ring-1 ring-white/5">
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide">Accepted</p>
                <p className="text-2xl font-bold text-green-400 mt-2">{quoteMetrics.accepted}</p>
              </div>
            </div>

            {/* Recent Quotes */}
            {quoteMetrics.recentQuotes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide mb-3">Recent Activity</p>
                <div className="space-y-2">
                  {quoteMetrics.recentQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="text-sm p-3 rounded-lg bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-primary-light font-medium truncate">{quote.quoteNumber}</span>
                        <span
                          className={cn(
                            'text-xs px-2.5 py-1 rounded-full font-medium',
                            quote.status === 'accepted' && 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20',
                            quote.status === 'rejected' && 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
                            quote.status === 'sent' && 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                          )}
                        >
                          {quote.status}
                        </span>
                      </div>
                      <p className="text-primary-light/50 text-xs mt-1.5">${quote.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          )}

          {/* Invoices Card - admin/owner only */}
          {!isEmployee && (
          <Card className="rounded-xl border-white/10 shadow-sm shadow-black/20 p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-primary-light tracking-tight">Invoices</h2>
              <Link to="/app/invoices">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {/* Invoice Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-primary-dark/50 rounded-lg p-4 ring-1 ring-white/5">
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide">Outstanding</p>
                <p className="text-2xl font-bold text-primary-gold mt-2">
                  ${invoiceMetrics.outstanding.toFixed(0)}
                </p>
              </div>
              <div className="bg-primary-dark/50 rounded-lg p-4 ring-1 ring-white/5">
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide">Overdue</p>
                <p className="text-2xl font-bold text-red-400 mt-2">{invoiceMetrics.overdue}</p>
              </div>
            </div>

            {/* Client Approval Status */}
            <div className="bg-primary-dark/50 rounded-lg p-4 mb-5 ring-1 ring-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-light/50">Client Approved</span>
                <span className="text-primary-light font-semibold">{invoiceMetrics.clientApproved}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-3">
                <span className="text-primary-light/50">Awaiting Approval</span>
                <span className="text-primary-light font-semibold">{invoiceMetrics.awaitingApproval}</span>
              </div>
            </div>

            {/* Recent Invoices */}
            {invoiceMetrics.recentInvoices.length > 0 && (
              <div>
                <p className="text-xs font-medium text-primary-light/50 uppercase tracking-wide mb-3">Recent Activity</p>
                <div className="space-y-2">
                  {invoiceMetrics.recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="text-sm p-3 rounded-lg bg-primary-dark/50 hover:bg-primary-dark hover:ring-1 hover:ring-white/10 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-primary-light font-medium truncate">{invoice.invoiceNumber}</span>
                        <span
                          className={cn(
                            'text-xs px-2.5 py-1 rounded-full font-medium',
                            invoice.status === 'overdue' && 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
                            invoice.status === 'sent' && 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                          )}
                        >
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-primary-light/50 text-xs mt-1.5">
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
