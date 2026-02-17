import { useMemo } from 'react'
import { Card, Button } from '@/components/ui'
import { downloadCsv } from '../utils/exportCsv'
import { format } from 'date-fns'
import type { JobLog } from '@/features/jobLogs/types/jobLog'
import type { Invoice } from '@/features/invoices/types/invoice'

interface JobsReportProps {
  startDate: Date
  endDate: Date
  jobLogs: JobLog[]
  invoices: Invoice[]
  timeEntries: Array<{
    id: string
    jobId?: string
    jobLogId?: string
    userId?: string
    startTime: string
    endTime: string
    breakMinutes?: number
  }>
}

export const JobsReport = ({
  startDate,
  endDate,
  jobLogs,
  invoices,
  timeEntries,
}: JobsReportProps) => {
  // Filter jobs by date range (createdAt)
  const filteredJobs = useMemo(() => {
    return jobLogs.filter(job => {
      const jobDate = new Date(job.createdAt)
      return jobDate >= startDate && jobDate <= endDate
    })
  }, [jobLogs, startDate, endDate])

  // Create invoice map for quick lookup
  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>()
    invoices.forEach(inv => {
      map.set(inv.id, inv)
    })
    return map
  }, [invoices])

  // Group by status
  const statusGroups = useMemo(() => {
    const groups: Record<string, JobLog[]> = {
      active: [],
      completed: [],
      inactive: [],
    }

    filteredJobs.forEach(job => {
      const status = job.status === 'archived' ? 'inactive' : (job.status || 'active')
      if (groups[status]) {
        groups[status].push(job)
      } else {
        groups[status] = [job]
      }
    })

    return groups
  }, [filteredJobs])

  // Calculate revenue from job prices
  const revenue = useMemo(() => {
    let totalRevenue = 0
    let paidRevenue = 0

    filteredJobs.forEach(job => {
      // Use job price if available
      const jobPrice = job.price || 0
      if (jobPrice > 0) {
        totalRevenue += jobPrice
        
        // If job has linked invoice, use paid amount from invoice
        // Otherwise, assume unpaid if price exists
        const invoiceId = (job as any).invoiceId
        if (invoiceId) {
          const invoice = invoiceMap.get(invoiceId)
          if (invoice) {
            // Use invoice paid amount, but cap at job price
            paidRevenue += Math.min(invoice.paidAmount, jobPrice)
          }
        }
      } else {
        // Fallback to invoice total if no job price
        const invoiceId = (job as any).invoiceId
        if (invoiceId) {
          const invoice = invoiceMap.get(invoiceId)
          if (invoice) {
            totalRevenue += invoice.total
            paidRevenue += invoice.paidAmount
          }
        }
      }
    })

    return { total: totalRevenue, paid: paidRevenue, outstanding: totalRevenue - paidRevenue }
  }, [filteredJobs, invoiceMap])

  // Calculate cost from time entries and job assignments
  const cost = useMemo(() => {
    let totalCost = 0

    // Filter time entries by date range
    const filteredEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime)
      return entryDate >= startDate && entryDate <= endDate
    })

    filteredEntries.forEach(entry => {
      const jobId = (entry as any).jobId || entry.jobLogId
      if (jobId) {
        const job = jobLogs.find(j => j.id === jobId)
        if (job && job.assignedTo) {
          const assignments = Array.isArray(job.assignedTo)
            ? job.assignedTo
            : typeof job.assignedTo === 'string'
              ? [{ userId: entry.userId || '', role: '', payType: 'job' as const }]
              : []

          const assignment = assignments.find((a: any) => a.userId === entry.userId)
          if (assignment && assignment.payType === 'hourly' && assignment.hourlyRate && entry.userId) {
            const start = new Date(entry.startTime).getTime()
            const end = new Date(entry.endTime).getTime()
            const breakMinutes = entry.breakMinutes || 0
            const hours = ((end - start) / 60000 - breakMinutes) / 60
            totalCost += hours * assignment.hourlyRate
          } else if (assignment && assignment.payType === 'job' && assignment.price) {
            // For job-based pay, we'd need to track which jobs have been paid
            // For now, we'll skip to avoid double-counting
          }
        }
      }
    })

    return totalCost
  }, [timeEntries, jobLogs, startDate, endDate])

  // Calculate totals
  const totals = useMemo(() => {
    const active = statusGroups.active.length
    const completed = statusGroups.completed.length
    const inactive = statusGroups.inactive.length

    return {
      total: filteredJobs.length,
      active,
      completed,
      inactive,
      revenue: revenue.total,
      paidRevenue: revenue.paid,
      outstandingRevenue: revenue.outstanding,
      cost,
      profit: revenue.total - cost,
    }
  }, [filteredJobs.length, statusGroups, revenue, cost])

  const handleExport = () => {
    const exportData = filteredJobs.map(job => {
      const invoiceId = (job as any).invoiceId
      const invoice = invoiceId ? invoiceMap.get(invoiceId) : null
      const status = job.status === 'archived' ? 'inactive' : (job.status || 'active')

      return {
        'Job Title': job.title,
        'Status': status,
        'Contact': job.contact?.name || '',
        'Location': job.location || '',
        'Price': job.price || '',
        'Linked Invoice': invoice ? invoice.invoiceNumber : '',
        'Invoice Total': invoice ? invoice.total.toFixed(2) : '',
        'Invoice Paid': invoice ? invoice.paidAmount.toFixed(2) : '',
        'Created': format(new Date(job.createdAt), 'yyyy-MM-dd'),
        'Updated': format(new Date(job.updatedAt), 'yyyy-MM-dd'),
      }
    })

    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`
    downloadCsv(exportData, `jobs-${dateRange}`)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary-light">Jobs Summary</h3>
          <p className="text-sm text-primary-light/60 mt-1">
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-primary-light/60">No jobs found for this period</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Total Jobs</p>
              <p className="text-2xl font-bold text-primary-gold mt-1">{totals.total}</p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Active</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{totals.active}</p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Completed</p>
              <p className="text-2xl font-bold text-primary-blue mt-1">{totals.completed}</p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Inactive</p>
              <p className="text-2xl font-bold text-primary-light/70 mt-1">{totals.inactive}</p>
            </div>
          </div>

          {/* Revenue & Cost */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Revenue</p>
              <p className="text-2xl font-bold text-primary-gold mt-1">
                ${totals.revenue.toFixed(2)}
              </p>
              {totals.outstandingRevenue > 0 && (
                <p className="text-xs text-primary-light/60 mt-1">
                  ${totals.outstandingRevenue.toFixed(2)} outstanding
                </p>
              )}
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Paid</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                ${totals.paidRevenue.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Cost</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                ${totals.cost.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Profit</p>
              <p className={`text-2xl font-bold mt-1 ${
                totals.profit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${totals.profit.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-primary-light uppercase tracking-wide">
              By Status
            </h4>
            <div className="space-y-2">
              {(['active', 'completed', 'inactive'] as const).map(status => {
                const group = statusGroups[status]
                if (group.length === 0) return null

                const statusLabels: Record<string, string> = {
                  active: 'Active',
                  completed: 'Completed',
                  inactive: 'Inactive',
                }

                const statusColors: Record<string, string> = {
                  active: 'bg-green-500/10 text-green-400',
                  completed: 'bg-blue-500/10 text-blue-400',
                  inactive: 'bg-primary-light/10 text-primary-light/70',
                }

                return (
                  <div
                    key={status}
                    className="flex items-center justify-between p-3 bg-primary-dark/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}
                      >
                        {statusLabels[status]}
                      </span>
                      <span className="text-sm text-primary-light">{group.length} jobs</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
