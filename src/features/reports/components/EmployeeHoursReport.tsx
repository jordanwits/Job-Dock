import { useMemo, useState } from 'react'
import { Card, Button } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { TimeEntry } from '@/features/jobLogs/types/jobLog'
import type { JobLog } from '@/features/jobLogs/types/jobLog'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
  const { user: currentUser } = useAuthStore()
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

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
    console.log('EmployeeHoursReport - isTeamAccount:', isTeamAccount)
    console.log(
      'EmployeeHoursReport - users count:',
      users.length,
      'users:',
      users.map(u => ({ id: u.id, name: u.name }))
    )
    console.log('EmployeeHoursReport - filteredEntries:', filteredEntries.length)
    if (filteredEntries.length > 0) {
      console.log('EmployeeHoursReport - sample entry:', filteredEntries[0])
      console.log(
        'EmployeeHoursReport - entries with userId:',
        filteredEntries.filter(e => e.userId).length
      )
      console.log('EmployeeHoursReport - unique userIds:', [
        ...new Set(filteredEntries.filter(e => e.userId).map(e => e.userId)),
      ])
    }

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
    let processedCount = 0
    let skippedNoUserId = 0
    let skippedSingleTier = 0

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
      if (!userId) {
        skippedNoUserId++
        return
      }

      // For single tier, only process current user's entries
      if (!isTeamAccount && userId !== currentUser?.id) {
        skippedSingleTier++
        return
      }

      processedCount++

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

      userData.totalMinutes += minutes
      userData.totalHours += hours
      userData.entryCount += 1

      // Find job and calculate pay
      // Backend returns jobId (from TimeEntry.jobId), frontend type has jobLogId
      // Both refer to the same Job/JobLog entity
      const jobId = (entry as any).jobId || (entry as any).jobLogId
      if (jobId) {
        const job = jobMap.get(jobId)
        if (job && job.assignedTo) {
          // Find assignment for this user
          const assignments = Array.isArray(job.assignedTo)
            ? job.assignedTo
            : typeof job.assignedTo === 'string'
              ? [{ userId, role: '', payType: 'job' as const }]
              : []

          const assignment = assignments.find((a: any) => a.userId === userId)
          if (assignment) {
            const payType = assignment.payType || 'job'
            let pay = 0

            if (payType === 'hourly' && assignment.hourlyRate) {
              pay = hours * assignment.hourlyRate
              userData.totalPay += pay
            } else if (payType === 'job' && assignment.price) {
              // For job-based pay, we'd need to track which jobs have been paid
              // For now, just show the job price (but don't add multiple times for same job)
              // This is a simplification - ideally we'd track per-job payment
            }

            // Track job details
            const existingJob = userData.jobs.find(j => j.jobId === jobId)
            if (!existingJob) {
              userData.jobs.push({
                jobId: jobId,
                jobTitle: job.title,
                hours,
                pay,
                payType: payType === 'hourly' ? 'Hourly' : 'Job-based',
              })
            } else {
              existingJob.hours += hours
              existingJob.pay += pay
            }
          }
        }
      }
    })

    console.log(
      'Processed entries:',
      processedCount,
      'Skipped (no userId):',
      skippedNoUserId,
      'Skipped (single tier):',
      skippedSingleTier
    )
    console.log('DataMap size:', dataMap.size)
    console.log(
      'DataMap entries:',
      Array.from(dataMap.values()).map(d => ({ name: d.userName, entries: d.entryCount }))
    )

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

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>
              {isTeamAccount ? 'Employee Hours & Pay' : 'Your Hours'}
            </h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-primary-gold hover:text-primary-gold/80 transition-colors text-sm font-medium self-start sm:self-center"
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              <span>Details</span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className={cn(
            "text-sm mt-1",
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} className="self-start sm:self-auto">
          Export CSV
        </Button>
      </div>

      {employeeData.length === 0 ? (
        <div className="text-center py-8">
          <p className={cn(
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>
            {isTeamAccount ? 'No team members found' : 'No time entries found for this period'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className={cn(
            "grid grid-cols-2 gap-4 p-4 rounded-lg",
            theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
          )}>
            <div className="min-w-0">
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Total Hours</p>
              <p className="text-xl md:text-2xl font-bold text-primary-gold mt-1 break-words">
                {totalHours.toLocaleString('en-US', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                h
              </p>
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Total Pay</p>
              <p className="text-xl md:text-2xl font-bold text-primary-gold mt-1 break-words">
                ${formatCurrency(totalPay)}
              </p>
            </div>
          </div>

          {/* Employee breakdown - Collapsible */}
          {isExpanded && (
            <div className="space-y-4">
              {employeeData.map(emp => {
            const hours = Math.floor(emp.totalHours)
            const minutes = Math.round((emp.totalHours - hours) * 60)
            const hasNoEntries = emp.entryCount === 0
            return (
              <div
                key={emp.userId}
                className={cn(
                  "border rounded-lg p-4 min-w-0",
                  theme === 'dark' ? 'border-white/5' : 'border-gray-200',
                  hasNoEntries ? 'opacity-60' : ''
                )}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "font-medium break-words",
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>{emp.userName}</p>
                    {emp.userEmail && (
                      <p className={cn(
                        "text-xs md:text-sm break-words",
                        theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                      )}>
                        {emp.userEmail}
                      </p>
                    )}
                  </div>
                  <div className="text-right min-w-0 flex-shrink-0">
                    {hasNoEntries ? (
                      <p className={cn(
                        "text-xs md:text-sm",
                        theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                      )}>No entries</p>
                    ) : (
                      <>
                        <p className="text-base md:text-lg font-semibold text-primary-gold break-words">
                          {hours}h {minutes}m
                        </p>
                        {emp.totalPay > 0 && (
                          <p className={cn(
                            "text-xs md:text-sm break-words",
                            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                          )}>
                            ${formatCurrency(emp.totalPay)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!hasNoEntries && (
                  <div className={cn(
                    "mt-3 pt-3 border-t",
                    theme === 'dark' ? 'border-white/5' : 'border-gray-200'
                  )}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn(
                        theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                      )}>Entries</span>
                      <span className={cn(
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>{formatNumber(emp.entryCount)}</span>
                    </div>
                    {emp.jobs.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() =>
                            setExpandedUserId(expandedUserId === emp.userId ? null : emp.userId)
                          }
                          className="text-sm text-primary-gold hover:text-primary-gold/80 transition-colors"
                        >
                          {expandedUserId === emp.userId ? 'Hide' : 'Show'} job details
                        </button>
                        {expandedUserId === emp.userId && (
                          <div className="mt-2 space-y-2">
                            {emp.jobs.map(job => (
                              <div
                                key={job.jobId}
                                className={cn(
                                  "p-2 rounded text-sm",
                                  theme === 'dark' ? 'bg-primary-dark/30' : 'bg-gray-100'
                                )}
                              >
                                <p className={cn(
                                  "font-medium",
                                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                                )}>{job.jobTitle}</p>
                                <div className={cn(
                                  "flex justify-between mt-1 gap-2 min-w-0",
                                  theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                                )}>
                                  <span className="break-words">{job.hours.toFixed(2)}h</span>
                                  {job.pay > 0 && (
                                    <span className="break-words text-right">
                                      ${formatCurrency(job.pay)} ({job.payType})
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
