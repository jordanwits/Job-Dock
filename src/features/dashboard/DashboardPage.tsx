import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useAuthStore } from '@/features/auth'
import { Card, Button } from '@/components/ui'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

const DashboardPage = () => {
  const { user } = useAuthStore()
  const { jobs, fetchJobs, isLoading: jobsLoading } = useJobStore()
  const { quotes, fetchQuotes, isLoading: quotesLoading } = useQuoteStore()
  const { invoices, fetchInvoices, isLoading: invoicesLoading } = useInvoiceStore()

  // Fetch all data on mount
  useEffect(() => {
    const now = new Date()
    const startDate = startOfMonth(now)
    const endDate = endOfMonth(addDays(now, 30)) // Fetch current and next month
    fetchJobs(startDate, endDate)
    fetchQuotes()
    fetchInvoices()
  }, [fetchJobs, fetchQuotes, fetchInvoices])

  // Get upcoming jobs (next 7 days, limit 5)
  const upcomingJobs = useMemo(() => {
    const today = new Date()
    const nextWeek = addDays(today, 7)

    return jobs
      .filter((job) => {
        const jobDate = new Date(job.startTime)
        return jobDate >= today && jobDate <= nextWeek && job.status !== 'cancelled'
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5)
  }, [jobs])

  // Quote metrics
  const quoteMetrics = useMemo(() => {
    const sent = quotes.filter((q) => q.status === 'sent').length
    const accepted = quotes.filter((q) => q.status === 'accepted').length
    const rejected = quotes.filter((q) => q.status === 'rejected').length
    const draft = quotes.filter((q) => q.status === 'draft').length

    // Recent sent quotes (last 3)
    const recentQuotes = quotes
      .filter((q) => q.status === 'sent' || q.status === 'accepted' || q.status === 'rejected')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)

    return { sent, accepted, rejected, draft, recentQuotes }
  }, [quotes])

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

  const isLoading = jobsLoading || quotesLoading || invoicesLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary-gold mb-2">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-primary-light/70">
          Here's what's happening with your business today
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-primary-light/70">Loading dashboard...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Jobs Card */}
          <Card className="lg:row-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-primary-light">Upcoming Jobs</h2>
              <Link to="/scheduling?tab=jobs">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            {upcomingJobs.length === 0 ? (
              <p className="text-primary-light/50 text-center py-8">
                No upcoming jobs in the next 7 days
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingJobs.map((job) => {
                  const statusColors = {
                    scheduled: 'bg-blue-500/20 text-blue-400',
                    'in-progress': 'bg-yellow-500/20 text-yellow-400',
                    completed: 'bg-green-500/20 text-green-400',
                    cancelled: 'bg-red-500/20 text-red-400',
                    'pending-confirmation': 'bg-orange-500/20 text-orange-400',
                  }

                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-lg bg-primary-dark hover:bg-primary-dark/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-primary-light truncate">{job.title}</h3>
                          <p className="text-sm text-primary-light/70 mt-1">
                            {format(new Date(job.startTime), 'MMM d, yyyy • h:mm a')}
                          </p>
                          {job.contactName && (
                            <p className="text-sm text-primary-light/60 mt-1">{job.contactName}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium whitespace-nowrap',
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

          {/* Quotes Card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-primary-light">Quotes</h2>
              <Link to="/quotes">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {/* Quote Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-primary-dark rounded-lg p-3">
                <p className="text-sm text-primary-light/70">Sent</p>
                <p className="text-2xl font-bold text-primary-gold">{quoteMetrics.sent}</p>
              </div>
              <div className="bg-primary-dark rounded-lg p-3">
                <p className="text-sm text-primary-light/70">Accepted</p>
                <p className="text-2xl font-bold text-green-400">{quoteMetrics.accepted}</p>
              </div>
            </div>

            {/* Recent Quotes */}
            {quoteMetrics.recentQuotes.length > 0 && (
              <div>
                <p className="text-sm text-primary-light/70 mb-2">Recent Activity</p>
                <div className="space-y-2">
                  {quoteMetrics.recentQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="text-sm p-2 rounded bg-primary-dark hover:bg-primary-dark/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-primary-light truncate">{quote.quoteNumber}</span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            quote.status === 'accepted' && 'bg-green-500/20 text-green-400',
                            quote.status === 'rejected' && 'bg-red-500/20 text-red-400',
                            quote.status === 'sent' && 'bg-blue-500/20 text-blue-400'
                          )}
                        >
                          {quote.status}
                        </span>
                      </div>
                      <p className="text-primary-light/60 text-xs mt-1">${quote.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Invoices Card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-primary-light">Invoices</h2>
              <Link to="/invoices">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {/* Invoice Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-primary-dark rounded-lg p-3">
                <p className="text-sm text-primary-light/70">Outstanding</p>
                <p className="text-2xl font-bold text-primary-gold">
                  ${invoiceMetrics.outstanding.toFixed(0)}
                </p>
              </div>
              <div className="bg-primary-dark rounded-lg p-3">
                <p className="text-sm text-primary-light/70">Overdue</p>
                <p className="text-2xl font-bold text-red-400">{invoiceMetrics.overdue}</p>
              </div>
            </div>

            {/* Client Approval Status */}
            <div className="bg-primary-dark rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-light/70">Client Approved</span>
                <span className="text-primary-light font-medium">{invoiceMetrics.clientApproved}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-primary-light/70">Awaiting Approval</span>
                <span className="text-primary-light font-medium">{invoiceMetrics.awaitingApproval}</span>
              </div>
            </div>

            {/* Recent Invoices */}
            {invoiceMetrics.recentInvoices.length > 0 && (
              <div>
                <p className="text-sm text-primary-light/70 mb-2">Recent Activity</p>
                <div className="space-y-2">
                  {invoiceMetrics.recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="text-sm p-2 rounded bg-primary-dark hover:bg-primary-dark/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-primary-light truncate">{invoice.invoiceNumber}</span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            invoice.status === 'overdue' && 'bg-red-500/20 text-red-400',
                            invoice.status === 'sent' && 'bg-blue-500/20 text-blue-400'
                          )}
                        >
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-primary-light/60 text-xs mt-1">
                        ${(invoice.total - invoice.paidAmount).toFixed(2)} due
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
