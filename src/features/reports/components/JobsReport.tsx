import { useMemo } from 'react'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { JobLog } from '@/features/jobLogs/types/jobLog'
import type { Invoice } from '@/features/invoices/types/invoice'
import {
  ReportSection,
  StatGrid,
  StatTile,
  BreakdownRow,
  DetailLabel,
  BriefcaseIcon,
  type Tone,
} from './reportsUi'

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

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  completed: { label: 'Completed', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'neutral' },
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
      const status = job.status === 'archived' ? 'inactive' : job.status || 'active'
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
          if (invoice && invoice.paymentStatus === 'paid') {
            paidRevenue += jobPrice
          }
        }
      } else {
        // Fallback to invoice total if no job price
        const invoiceId = (job as any).invoiceId
        if (invoiceId) {
          const invoice = invoiceMap.get(invoiceId)
          if (invoice) {
            totalRevenue += invoice.total
            if (invoice.paymentStatus === 'paid') {
              paidRevenue += invoice.total
            }
          }
        }
      }
    })

    return { total: totalRevenue, paid: paidRevenue, outstanding: totalRevenue - paidRevenue }
  }, [filteredJobs, invoiceMap])

  // Calculate cost from time entries and job assignments
  const cost = useMemo(() => {
    let totalCost = 0
    const jobPayCounted = new Set<string>() // jobId_userId to avoid double-counting job-based pay

    // Filter time entries by date range
    const filteredEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime)
      return entryDate >= startDate && entryDate <= endDate
    })

    filteredEntries.forEach(entry => {
      let jobId = (entry as any).jobId || entry.jobLogId
      let userId = entry.userId

      // If userId is missing, try to infer from job assignment
      if (!userId && jobId) {
        const job = jobLogs.find(j => j.id === jobId)
        if (job?.assignedTo) {
          const assignments = Array.isArray(job.assignedTo)
            ? job.assignedTo
            : typeof job.assignedTo === 'string'
              ? [{ userId: job.assignedTo, role: '', payType: 'job' as const }]
              : []
          if (assignments.length > 0 && (assignments[0] as any).userId) {
            userId = (assignments[0] as any).userId
          }
        }
      }

      if (!jobId || !userId) return

      const job = jobLogs.find(j => j.id === jobId)
      if (!job || !job.assignedTo) return

      const assignments = Array.isArray(job.assignedTo)
        ? job.assignedTo
        : typeof job.assignedTo === 'string'
          ? [{ userId, role: '', payType: 'job' as const }]
          : []

      const assignment = assignments.find((a: any) => a.userId === userId)
      if (!assignment) return

      const payType = assignment.payType || 'job'
      if (payType === 'hourly') {
        const rate = (entry as any).hourlyRate ?? assignment.hourlyRate
        if (rate != null && !isNaN(rate)) {
          const start = new Date(entry.startTime).getTime()
          const end = new Date(entry.endTime).getTime()
          const breakMinutes = entry.breakMinutes || 0
          const hours = ((end - start) / 60000 - breakMinutes) / 60
          totalCost += hours * rate
        }
      } else {
        // Job-based: fixed price per job per employee (assignment.price or job price)
        const jobPrice =
          assignment.price ??
          job.price ??
          (job as { job?: { price?: number | null } }).job?.price ??
          0
        if (jobPrice != null && !isNaN(jobPrice) && jobPrice > 0) {
          const key = `${jobId}_${userId}`
          if (!jobPayCounted.has(key)) {
            jobPayCounted.add(key)
            totalCost += jobPrice
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
      const status = job.status === 'archived' ? 'inactive' : job.status || 'active'

      return {
        'Job Title': job.title,
        Status: status,
        Contact: job.contact?.name || '',
        Location: job.location || '',
        Price: job.price != null ? formatCurrency(job.price) : '',
        'Linked Invoice': invoice ? invoice.invoiceNumber : '',
        'Invoice Total': invoice ? formatCurrency(invoice.total) : '',
        'Invoice Paid': invoice ? formatCurrency(invoice.paidAmount) : '',
        Created: format(new Date(job.createdAt), 'yyyy-MM-dd'),
        Updated: format(new Date(job.updatedAt), 'yyyy-MM-dd'),
      }
    })

    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`
    downloadCsv(exportData, `jobs-${dateRange}`)
  }

  const isEmpty = filteredJobs.length === 0

  const details = (
    <div className="space-y-6">
      <StatGrid>
        <StatTile label="Revenue" value={`$${formatCurrency(totals.revenue)}`} tone="accent" />
        <StatTile label="Paid" value={`$${formatCurrency(totals.paidRevenue)}`} tone="success" />
        <StatTile label="Cost" value={`$${formatCurrency(totals.cost)}`} tone="danger" />
        <StatTile
          label="Profit"
          value={`$${formatCurrency(totals.profit)}`}
          tone={totals.profit >= 0 ? 'success' : 'danger'}
        />
      </StatGrid>

      <div className="space-y-3">
        <DetailLabel>By status</DetailLabel>
        <div className="divide-y divide-line">
          {(['active', 'completed', 'inactive'] as const).map(status => {
            const group = statusGroups[status]
            if (group.length === 0) return null
            const meta = STATUS_META[status]
            return (
              <BreakdownRow
                key={status}
                tone={meta.tone}
                label={meta.label}
                count={`${formatNumber(group.length)} ${group.length === 1 ? 'job' : 'jobs'}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <ReportSection
      title="Jobs"
      onExport={handleExport}
      exportDisabled={isEmpty}
      empty={isEmpty}
      emptyIcon={<BriefcaseIcon className="h-6 w-6" />}
      emptyText="No jobs found for this period"
      defaultOpen
      details={details}
    >
      <StatGrid>
        <StatTile label="Total Jobs" value={formatNumber(totals.total)} tone="accent" />
        <StatTile label="Active" value={formatNumber(totals.active)} tone="success" />
        <StatTile label="Completed" value={formatNumber(totals.completed)} tone="info" />
        <StatTile label="Inactive" value={formatNumber(totals.inactive)} tone="muted" />
      </StatGrid>
    </ReportSection>
  )
}
