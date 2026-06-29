import { useMemo } from 'react'
import { useAuthStore } from '@/features/auth'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { TimeEntry } from '@/features/jobLogs/types/jobLog'
import type { JobLog } from '@/features/jobLogs/types/jobLog'
import {
  ReportSection,
  StatGrid,
  StatTile,
  Avatar,
  UsersIcon,
} from './reportsUi'

interface EmployeeHoursReportProps {
  startDate: Date
  endDate: Date
  timeEntries: TimeEntry[]
  jobLogs: JobLog[]
  users: Array<{ id: string; name: string; email: string }>
  isTeamAccount: boolean
}

interface EmployeeHoursData {
  userId: string
  userName: string
  userEmail: string
  totalHours: number
  totalMinutes: number
  totalPay: number
  entryCount: number
  jobs: Array<{
    jobId: string
    jobTitle: string
    hours: number
    pay: number
    payType: string
  }>
}

export const EmployeeHoursReport = ({
  startDate,
  endDate,
  timeEntries,
  jobLogs,
  users,
  isTeamAccount,
}: EmployeeHoursReportProps) => {
  const { user: currentUser } = useAuthStore()

  // Create a map of jobId -> job for quick lookup
  const jobMap = useMemo(() => {
    const map = new Map<string, JobLog>()
    jobLogs.forEach(job => {
      map.set(job.id, job)
    })
    return map
  }, [jobLogs])

  // Create a map of userId -> user
  const userMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>()
    users.forEach(u => {
      map.set(u.id, u)
    })
    return map
  }, [users])

  // Filter time entries by date range
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime)
      return entryDate >= startDate && entryDate <= endDate
    })
  }, [timeEntries, startDate, endDate])

  // Aggregate hours and pay by employee
  const employeeData = useMemo(() => {
    const dataMap = new Map<string, EmployeeHoursData>()

    // Initialize data for all users (if team) or just current user (if single)
    // For team accounts, show ALL team members even if they have 0 hours
    if (isTeamAccount) {
      users.forEach(u => {
        dataMap.set(u.id, {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          totalHours: 0,
          totalMinutes: 0,
          totalPay: 0,
          entryCount: 0,
          jobs: [],
        })
      })
    } else if (currentUser) {
      // For single tier, just initialize current user
      dataMap.set(currentUser.id, {
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        totalHours: 0,
        totalMinutes: 0,
        totalPay: 0,
        entryCount: 0,
        jobs: [],
      })
    }

    // Process each time entry
    filteredEntries.forEach(entry => {
      let userId = entry.userId

      // If userId is missing, try to infer from job assignment
      if (!userId) {
        const jobId = (entry as any).jobId || (entry as any).jobLogId
        if (jobId) {
          const job = jobMap.get(jobId)
          if (job && job.assignedTo) {
            const assignments = Array.isArray(job.assignedTo)
              ? job.assignedTo
              : typeof job.assignedTo === 'string'
                ? [{ userId: job.assignedTo, role: '', payType: 'job' as const }]
                : []
            // Use first assignment if available
            if (assignments.length > 0 && assignments[0].userId) {
              userId = assignments[0].userId
            }
          }
        }
      }

      // Skip entries without userId
      if (!userId) return

      // For single tier, only process current user's entries
      if (!isTeamAccount && userId !== currentUser?.id) return

      // Get or create user data entry
      let userData = dataMap.get(userId)
      if (!userData) {
        // Create entry for user if not exists (e.g., user was removed but has historical entries)
        const user = userMap.get(userId)
        if (user) {
          userData = {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            totalHours: 0,
            totalMinutes: 0,
            totalPay: 0,
            entryCount: 0,
            jobs: [],
          }
          dataMap.set(userId, userData)
        } else {
          // User not found in map, try to use userName from entry if available
          const userName = entry.userName || `User ${userId.substring(0, 8)}`
          userData = {
            userId: userId,
            userName: userName,
            userEmail: '',
            totalHours: 0,
            totalMinutes: 0,
            totalPay: 0,
            entryCount: 0,
            jobs: [],
          }
          dataMap.set(userId, userData)
        }
      }

      // Calculate hours for this entry
      const start = new Date(entry.startTime).getTime()
      const end = new Date(entry.endTime).getTime()
      const breakMinutes = entry.breakMinutes || 0
      const minutes = (end - start) / 60000 - breakMinutes
      const hours = minutes / 60

      // Skip malformed/in-progress entries (bad dates, end <= start, or a break
      // longer than the worked time) so they can't silently subtract from totals.
      if (!Number.isFinite(minutes) || minutes <= 0) return

      userData.totalMinutes += minutes
      userData.totalHours += hours
      userData.entryCount += 1

      // Attribute this entry's hours to its job so the per-job breakdown always
      // reconciles with the member's headline total — even when the user has no pay
      // assignment on the job (assignment removed, or clocked into an unassigned job)
      // or the job is archived. Pay is only added when a rate/price is configured.
      // Backend returns jobId (from TimeEntry.jobId); the frontend type has jobLogId.
      const jobId = (entry as any).jobId || (entry as any).jobLogId
      if (jobId) {
        const job = jobMap.get(jobId)
        const assignments =
          job && job.assignedTo
            ? Array.isArray(job.assignedTo)
              ? job.assignedTo
              : typeof job.assignedTo === 'string'
                ? [{ userId, role: '', payType: 'job' as const }]
                : []
            : []

        const assignment = assignments.find((a: any) => a.userId === userId)
        const payType = assignment?.payType || 'job'
        let pay = 0

        if (assignment) {
          if (payType === 'hourly') {
            const rate = (entry as any).hourlyRate ?? assignment.hourlyRate
            if (rate != null && !isNaN(rate)) pay = hours * rate
            userData.totalPay += pay
          } else if (payType === 'job') {
            // Job-based: per-person flat pay from assignment.price ONLY. job.price is the
            // customer price (revenue), not labor — matching how JobLogDetail shows $X/job.
            const jobPrice = assignment.price
            if (jobPrice != null && !isNaN(jobPrice) && jobPrice > 0) {
              const alreadyCounted = userData.jobs.some(j => j.jobId === jobId)
              if (!alreadyCounted) {
                // Attribute job price once per job per user (not per time entry)
                pay = jobPrice
                userData.totalPay += pay
              }
            }
          }
        }

        // Track per-job hours/pay (accumulate across this user's entries on the job).
        const existingJob = userData.jobs.find(j => j.jobId === jobId)
        if (!existingJob) {
          userData.jobs.push({
            jobId: jobId,
            jobTitle: job?.title ?? 'Unknown job',
            hours,
            pay,
            payType: payType === 'hourly' ? 'Hourly' : 'Job-based',
          })
        } else {
          existingJob.hours += hours
          existingJob.pay += pay
        }
      }
    })

    // Convert to array and sort by total hours (descending)
    // For team accounts, show all members (even with 0 hours)
    // For single accounts, only show if they have entries
    const result = Array.from(dataMap.values())
    if (isTeamAccount) {
      // Show all team members, sorted by hours (descending), with 0-hour members at the end
      return result.sort((a, b) => {
        if (a.entryCount === 0 && b.entryCount > 0) return 1
        if (b.entryCount === 0 && a.entryCount > 0) return -1
        return b.totalHours - a.totalHours
      })
    } else {
      // Single account: only show if they have entries
      return result.filter(d => d.entryCount > 0).sort((a, b) => b.totalHours - a.totalHours)
    }
  }, [filteredEntries, jobMap, userMap, users, isTeamAccount, currentUser])

  const handleExport = () => {
    const exportData = employeeData.flatMap(emp => {
      if (emp.jobs.length === 0) {
        return [
          {
            'Employee Name': emp.userName,
            Email: emp.userEmail,
            'Total Hours': emp.totalHours.toFixed(2),
            'Total Pay': formatCurrency(emp.totalPay),
            'Entry Count': formatNumber(emp.entryCount),
            Job: 'N/A',
            'Job Hours': '',
            'Job Pay': '',
            'Pay Type': '',
          },
        ]
      }
      return emp.jobs.map(job => ({
        'Employee Name': emp.userName,
        Email: emp.userEmail,
        'Total Hours': emp.totalHours.toFixed(2),
        'Total Pay': emp.totalPay.toFixed(2),
        'Entry Count': emp.entryCount,
        Job: job.jobTitle,
        'Job Hours': job.hours.toFixed(2),
        'Job Pay': formatCurrency(job.pay),
        'Pay Type': job.payType,
      }))
    })

    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`
    downloadCsv(exportData, `employee-hours-${dateRange}`)
  }

  const totalHours = employeeData.reduce((sum, emp) => sum + emp.totalHours, 0)
  const totalPay = employeeData.reduce((sum, emp) => sum + emp.totalPay, 0)

  const isEmpty = employeeData.length === 0

  const details = (
    <div className="divide-y divide-line">
      {employeeData.map(emp => {
        const hours = Math.floor(emp.totalHours)
        const minutes = Math.round((emp.totalHours - hours) * 60)
        const hasNoEntries = emp.entryCount === 0
        return (
          <div key={emp.userId} className={hasNoEntries ? 'py-4 opacity-60' : 'py-4'}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={emp.userName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{emp.userName}</p>
                  {emp.userEmail && (
                    <p className="truncate text-[13px] text-ink-subtle">{emp.userEmail}</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {hasNoEntries ? (
                  <p className="text-[13px] text-ink-subtle">No entries</p>
                ) : (
                  <>
                    <p className="font-mono text-base font-semibold tabular-nums text-accent-strong">
                      {hours}h {minutes}m
                    </p>
                    {emp.totalPay > 0 && (
                      <p className="text-[13px] text-ink-muted">${formatCurrency(emp.totalPay)}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {!hasNoEntries && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-muted">Entries</span>
                  <span className="font-mono tabular-nums text-ink">{formatNumber(emp.entryCount)}</span>
                </div>
                {emp.jobs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {emp.jobs.map(job => (
                      <div
                        key={job.jobId}
                        className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-[13px] font-medium text-ink">
                          {job.jobTitle}
                        </span>
                        <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink-muted">
                          {job.hours.toFixed(2)}h ·{' '}
                          {job.pay > 0 ? (
                            `$${formatCurrency(job.pay)}`
                          ) : (
                            <span className="not-italic text-ink-subtle">Pay not set</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <ReportSection
      title={isTeamAccount ? 'Employee Hours & Pay' : 'Your Hours'}
      onExport={handleExport}
      exportDisabled={isEmpty}
      empty={isEmpty}
      emptyIcon={<UsersIcon className="h-6 w-6" />}
      emptyText={isTeamAccount ? 'No team members found' : 'No time entries found for this period'}
      defaultOpen
      details={details}
    >
      <StatGrid className="sm:max-w-md sm:grid-cols-2">
        <StatTile
          label="Total Hours"
          value={`${totalHours.toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}h`}
          tone="accent"
        />
        <StatTile label="Total Pay" value={`$${formatCurrency(totalPay)}`} tone="success" />
      </StatGrid>
    </ReportSection>
  )
}
