import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Card, Button, StatusBadgeSelect } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth'
import type { JobLog, JobAssignment } from '../types/jobLog'
import { getRecurringTag } from '../utils/recurringPattern'
import JobLogForm from './JobLogForm'
import TimeTracker from './TimeTracker'
import PhotoCapture from './PhotoCapture'
import JobLogNotes from './JobLogNotes'
import { useJobLogStore } from '../store/jobLogStore'

const TIMER_STORAGE_KEY = 'joblog-active-timer'


interface JobLogDetailProps {
  jobLog: JobLog
  showCreatedBy?: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  isEditing: boolean
  onCancelEdit: () => void
  onSaveEdit: (data: {
    title: string
    description?: string
    location?: string
    notes?: string
    jobId?: string
    contactId?: string
    assignedTo?: JobAssignment[]
    status?: string
  }) => Promise<void>
  onStatusChange?: (status: 'active' | 'completed' | 'inactive') => Promise<void>
  isLoading?: boolean
}

type Tab = 'clock' | 'photos' | 'notes'

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'inactive', label: 'Inactive' },
] as const

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const JobLogDetail = ({
  jobLog,
  showCreatedBy,
  onBack,
  onEdit,
  onDelete,
  isEditing,
  onCancelEdit,
  onSaveEdit,
  onStatusChange,
  isLoading,
}: JobLogDetailProps) => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createTimeEntry } = useJobLogStore()
  const [activeTab, setActiveTab] = useState<Tab>('notes')
  const [showMenu, setShowMenu] = useState(false)
  const canAccessQuotes = user?.role !== 'employee'
  const canEditJobs = user?.role === 'admin' || user?.role === 'owner' || user?.canCreateJobs || user?.canScheduleAppointments

  // Timer state management
  const [isTimerRunning, setIsTimerRunning] = useState(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!stored) return false
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLog.id && startTime
    } catch {
      return false
    }
  })
  const [timerStart, setTimerStart] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!stored) return null
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLog.id && startTime ? new Date(startTime) : null
    } catch {
      return null
    }
  })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Timer tick effect
  const tick = useCallback(() => {
    if (timerStart) {
      setElapsedSeconds(Math.floor((Date.now() - timerStart.getTime()) / 1000))
    }
  }, [timerStart])

  useEffect(() => {
    if (!isTimerRunning || !timerStart) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isTimerRunning, timerStart, tick])

  const formatElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStartTimer = () => {
    const start = new Date()
    setTimerStart(start)
    setIsTimerRunning(true)
    try {
      localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({
          jobLogId: jobLog.id,
          startTime: start.toISOString(),
        })
      )
    } catch {
      // ignore
    }
  }

  const handleStopTimer = async () => {
    let startTime: string
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (stored) {
        const { jobLogId: storedId, startTime: storedStart } = JSON.parse(stored)
        if (storedId === jobLog.id && storedStart) {
          startTime = storedStart
        } else if (timerStart) {
          startTime = timerStart.toISOString()
        } else {
          return
        }
      } else if (timerStart) {
        startTime = timerStart.toISOString()
      } else {
        return
      }
    } catch {
      if (!timerStart) return
      startTime = timerStart.toISOString()
    }
    const end = new Date()
    try {
      await createTimeEntry({
        jobLogId: jobLog.id,
        startTime,
        endTime: end.toISOString(),
        userId: user?.id,
      })
    } finally {
      setIsTimerRunning(false)
      setTimerStart(null)
      setElapsedSeconds(0)
      try {
        localStorage.removeItem(TIMER_STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }

  const handleMarkCompleted = async () => {
    if (onStatusChange) {
      await onStatusChange('completed')
    }
  }

  const isCompleted = jobLog.status === 'completed' || String(jobLog.status) === 'archived'

  const parsedAssignments = useMemo((): JobAssignment[] => {
    if (!jobLog.assignedTo) return []
    if (Array.isArray(jobLog.assignedTo)) {
      if (
        jobLog.assignedTo.length > 0 &&
        typeof jobLog.assignedTo[0] === 'object' &&
        'userId' in jobLog.assignedTo[0]
      ) {
        return jobLog.assignedTo as JobAssignment[]
      }
      return (jobLog.assignedTo as string[]).map(id => ({
        userId: id,
        role: 'Team Member',
        price: null,
        payType: 'job' as const,
        hourlyRate: null,
      }))
    }
    return [
      {
        userId: jobLog.assignedTo as string,
        role: 'Team Member',
        price: null,
        payType: 'job' as const,
        hourlyRate: null,
      },
    ]
  }, [jobLog.assignedTo])

  const handleCreateQuote = () => {
    setShowMenu(false)
    const params = new URLSearchParams()
    params.set('returnTo', '/app/job-logs/' + jobLog.id)
    params.set('openCreateQuote', '1')
    if (jobLog.contactId) params.set('contactId', jobLog.contactId)
    if (jobLog.title) params.set('title', jobLog.title)
    if (jobLog.notes) params.set('notes', jobLog.notes)
    navigate('/app/quotes?' + params.toString())
  }

  const handleScheduleAppointment = () => {
    setShowMenu(false)
    const params = new URLSearchParams()
    params.set('tab', 'calendar')
    params.set('returnTo', '/app/job-logs/' + jobLog.id)
    params.set('openCreateJob', '1')
    if (jobLog.contactId) params.set('contactId', jobLog.contactId)
    if (jobLog.title) params.set('title', jobLog.title)
    if (jobLog.notes) params.set('notes', jobLog.notes)
    if (jobLog.location) params.set('location', jobLog.location)
    if (jobLog.description) params.set('description', jobLog.description)
    navigate('/app/scheduling?' + params.toString())
  }

  if (isEditing) {
    return (
      <div className="max-w-[95vw] sm:max-w-[90vw] md:max-w-6xl lg:max-w-7xl mx-auto">
        <Card>
          <h3 className="text-lg font-semibold text-primary-light mb-4">Edit Job</h3>
          <JobLogForm
            jobLog={jobLog}
            onSubmit={onSaveEdit}
            onCancel={onCancelEdit}
            isLoading={isLoading}
          />
        </Card>
      </div>
    )
  }

  const hasOverview = jobLog.location || jobLog.contact
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  const canSeePrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)
  const primaryPrice = canSeePrices ? (
    jobLog.price ??
    jobLog.job?.price ??
    (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.price : null) ??
    null
  ) : null
  const primaryServiceName =
    jobLog.serviceName ??
    jobLog.job?.serviceName ??
    (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.service?.name : null) ??
    null
  const primaryStartTime = jobLog.startTime ?? jobLog.job?.startTime ?? null
  const primaryEndTime = jobLog.endTime ?? jobLog.job?.endTime ?? null

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Top bar: back left, menu right on mobile */}
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-primary-light/60 hover:text-primary-gold transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Jobs
        </button>
        {/* Mobile: three-dot menu in top right */}
        <div className="relative sm:hidden ml-auto">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-primary-blue/20 text-primary-light transition-colors"
            aria-label="Actions"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 12m-2 0a2 2 0 1 1 4 0a2 2 0 1 1-4 0M12 12m-2 0a2 2 0 1 1 4 0a2 2 0 1 1-4 0M18 12m-2 0a2 2 0 1 1 4 0a2 2 0 1 1-4 0" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 py-1 w-56 bg-primary-dark-secondary border border-primary-blue rounded-lg shadow-xl z-50">
                {canAccessQuotes && (
                  <button
                    onClick={handleCreateQuote}
                    className="w-full text-left px-4 py-2.5 text-sm text-primary-light hover:bg-primary-blue/20"
                  >
                    Create Quote
                  </button>
                )}
                <button
                  onClick={handleScheduleAppointment}
                  className="w-full text-left px-4 py-2.5 text-sm text-primary-light hover:bg-primary-blue/20"
                >
                  Schedule Appointment
                </button>
                {canEditJobs && (
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onEdit()
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-primary-light hover:bg-primary-blue/20"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDelete()
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Header content - title, status, assigned to, and desktop buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-primary-light break-words">{jobLog.title}</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {onStatusChange ? (
              <StatusBadgeSelect
                value={
                  String(jobLog.status) === 'archived' ? 'inactive' : jobLog.status || 'active'
                }
                options={statusOptions.map(o => ({ value: o.value, label: o.label }))}
                colorClassesByValue={statusColors}
                onChange={async v => {
                  await onStatusChange(v as 'active' | 'completed' | 'inactive')
                }}
                isLoading={isLoading}
                size="md"
              />
            ) : (
              <span
                className={cn(
                  'px-2.5 py-1 text-xs font-medium capitalize shrink-0',
                  statusColors[
                    (String(jobLog.status) === 'archived' ? 'inactive' : jobLog.status) || 'active'
                  ]
                )}
              >
                {String(jobLog.status) === 'archived' ? 'Inactive' : jobLog.status || 'Active'}
              </span>
            )}
            <span className="text-sm text-primary-light/50 shrink-0">
              {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
            </span>
            {primaryPrice != null && (
              <span className="text-sm font-semibold text-primary-gold shrink-0">
                $
                {primaryPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
          {(jobLog.assignedToName || (showCreatedBy && jobLog.job?.createdByName)) && (
            <div className="flex flex-col gap-2 mt-2">
              {jobLog.assignedToName &&
                (() => {
                  const getTotalMinutesForUser = (userId: string): number => {
                    const entries = (jobLog.timeEntries ?? []).filter(te => te.userId === userId)
                    return entries.reduce((sum, te) => {
                      const start = new Date(te.startTime).getTime()
                      const end = new Date(te.endTime).getTime()
                      const breakMin = te.breakMinutes ?? 0
                      return sum + (end - start) / 60000 - breakMin
                    }, 0)
                  }

                  const assignments = parsedAssignments
                  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
                  const currentUserId = user?.id
                  const canSeePrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)

                  // If we have assignments with roles, show them with pricing
                  if (assignments.length > 0 && assignments[0].role) {
                    return (
                      <div>
                        <span className="text-xs font-medium text-primary-light/70 mb-1.5 block">
                          Assigned to
                        </span>
                        <div className="grid grid-cols-1 gap-2 w-max max-w-md">
                          {assignments.map((assignment, index) => {
                            // Find name from assignedToName by index (approximate match)
                            const nameParts = jobLog.assignedToName?.split(',') || []
                            const nameFromString = nameParts[index]?.trim()
                            // Show "Unassigned" instead of "User 1", "User 2", etc. when name is not available
                            const displayName = nameFromString || 'Unassigned'
                            const canSeePrice =
                              canSeePrices && (isAdminOrOwner || assignment.userId === currentUserId)
                            const payType = assignment.payType || 'job'
                            const price = canSeePrice ? assignment.price : undefined
                            const hourlyRate = canSeePrice ? assignment.hourlyRate : undefined
                            const totalMinutes = getTotalMinutesForUser(assignment.userId)
                            const totalHours = totalMinutes / 60
                            const totalEarned =
                              payType === 'hourly' && hourlyRate != null && !isNaN(hourlyRate)
                                ? totalHours * hourlyRate
                                : null

                            const hasJobPrice =
                              payType === 'job' && price !== null && price !== undefined
                            const hasHourlyRate =
                              payType === 'hourly' &&
                              hourlyRate !== null &&
                              hourlyRate !== undefined
                            const hasPayInfo = hasJobPrice || hasHourlyRate
                            return (
                              <div
                                key={assignment.userId || index}
                                className={cn(
                                  'flex items-center rounded-md bg-primary-dark-secondary/50 border border-primary-blue/30 w-full',
                                  hasPayInfo ? 'flex-row gap-3 px-2 py-1.5' : 'px-2 py-1'
                                )}
                              >
                                <div className="min-w-0 flex-shrink">
                                  <span className="text-primary-light font-medium">
                                    {displayName}
                                  </span>
                                  {assignment.role && assignment.role !== 'Team Member' && (
                                    <span className="text-primary-light/60 ml-2">
                                      ({assignment.role})
                                    </span>
                                  )}
                                </div>
                                {hasPayInfo && (
                                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                    {hasJobPrice && (
                                      <span className="text-primary-gold font-semibold">
                                        $
                                        {price!.toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                        /job
                                      </span>
                                    )}
                                    {hasHourlyRate && (
                                      <>
                                        <span className="text-primary-gold font-semibold">
                                          $
                                          {hourlyRate!.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                          /hr
                                        </span>
                                        {totalEarned != null && (
                                          <span className="text-xs text-primary-light/70">
                                            Earned: $
                                            {totalEarned.toLocaleString('en-US', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  // Fallback to simple name display for old format
                  return (
                    <div>
                      <span className="text-xs font-medium text-primary-light/70 mb-1.5 block">
                        Assigned to
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {jobLog.assignedToName.split(',').map((name, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary-blue/20 text-primary-light/90 border border-primary-blue/30 break-words"
                          >
                            {name.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              {showCreatedBy && jobLog.job?.createdByName && (
                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary-blue/20 text-primary-light/90 border border-primary-blue/30 break-words">
                  Created by {jobLog.job.createdByName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mobile: Timer and Mark Completed buttons - after header */}
        <div className="sm:hidden flex items-center gap-2 pt-2">
          {!isTimerRunning ? (
            <>
              <Button
                onClick={handleStartTimer}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5"
                size="sm"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Start Timer
              </Button>
              {!isCompleted && onStatusChange && (
                <Button
                  onClick={handleMarkCompleted}
                  className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark px-4 py-1.5"
                  size="sm"
                  disabled={isLoading}
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Mark Complete
                </Button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-dark rounded-lg border border-primary-blue/30 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg font-mono text-primary-gold tabular-nums">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
              <Button
                onClick={handleStopTimer}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 shrink-0"
                size="sm"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10h6v4H9z"
                  />
                </svg>
                Stop Timer
              </Button>
            </div>
          )}
        </div>

        {/* Desktop: inline buttons */}
        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
          <div className="flex flex-wrap gap-2">
            {canAccessQuotes && (
              <Button variant="outline" size="sm" onClick={handleCreateQuote}>
                Create Quote
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleScheduleAppointment}>
              Schedule Appointment
            </Button>
            {canEditJobs && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-red-400 border-red-500/50 hover:bg-red-500/10"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>

          {/* Desktop: Timer and Mark Completed buttons - separate row, aligned right */}
          <div className="flex items-center gap-2">
            {!isTimerRunning ? (
              <>
                <Button
                  onClick={handleStartTimer}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5"
                  size="sm"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Start Timer
                </Button>
                {!isCompleted && onStatusChange && (
                  <Button
                    onClick={handleMarkCompleted}
                    className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark px-4 py-1.5"
                    size="sm"
                    disabled={isLoading}
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Mark Complete
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-dark rounded-lg border border-primary-blue/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-lg font-mono text-primary-gold tabular-nums">
                    {formatElapsed(elapsedSeconds)}
                  </span>
                </div>
                <Button
                  onClick={handleStopTimer}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5"
                  size="sm"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 10h6v4H9z"
                    />
                  </svg>
                  Stop Timer
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Bookings */}
      {jobLog.bookings && jobLog.bookings.length > 0 && (() => {
        const sortedBookings = jobLog.bookings
          .filter(b => b.status !== 'cancelled')
          .sort((a, b) => {
            const aTime = a.startTime ? new Date(a.startTime).getTime() : 0
            const bTime = b.startTime ? new Date(b.startTime).getTime() : 0
            return aTime - bTime
          })

        // Get the next upcoming booking
        const nextBooking = sortedBookings.find(b => {
          if (b.toBeScheduled) return false
          if (!b.startTime) return false
          const bookingDate = new Date(b.startTime)
          return bookingDate >= new Date()
        }) || sortedBookings[0]

        if (!nextBooking) return null

        // Check if bookings follow a recurring pattern
        const recurringTag = getRecurringTag(sortedBookings)

        return (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-primary-light/70 uppercase tracking-wider">
              Upcoming Bookings
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-primary-dark/50 border border-primary-blue/20">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {nextBooking.toBeScheduled ? (
                      <span className="text-primary-light/70 text-sm">To be scheduled</span>
                    ) : nextBooking.startTime && nextBooking.endTime ? (
                      <span className="text-primary-light text-sm">
                        {format(new Date(nextBooking.startTime), 'MMM d, yyyy • h:mm a')} –{' '}
                        {format(new Date(nextBooking.endTime), 'h:mm a')}
                      </span>
                    ) : (
                      <span className="text-primary-light/70 text-sm">No time set</span>
                    )}
                    {recurringTag && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-primary-blue/20 text-primary-gold border border-primary-blue/30 rounded shrink-0">
                        {recurringTag}
                      </span>
                    )}
                  </div>
                  {nextBooking.service?.name && (
                    <p className="text-xs text-primary-light/50 mt-0.5">{nextBooking.service.name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {canSeePrices && nextBooking.price != null && nextBooking.price !== undefined && (
                    <span className="text-sm font-semibold text-primary-gold">
                      $
                      {nextBooking.price.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Overview: contact, location, and price */}
      {(hasOverview ||
        !!jobLog.description ||
        primaryPrice != null ||
        !!primaryServiceName ||
        (!!primaryStartTime && !!primaryEndTime)) && (
        <dl className="space-y-3">
          {jobLog.description && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">
                Description
              </dt>
              <dd className="text-sm text-primary-light/90 mt-1 whitespace-pre-wrap">
                {jobLog.description}
              </dd>
            </div>
          )}
          {primaryServiceName && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">
                Service
              </dt>
              <dd className="text-sm text-primary-light/90 mt-1">{primaryServiceName}</dd>
            </div>
          )}
          {primaryStartTime && primaryEndTime && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">
                Scheduled
              </dt>
              <dd className="text-sm text-primary-light/90 mt-1">
                {(() => {
                  const start = new Date(primaryStartTime)
                  const end = new Date(primaryEndTime)
                  const isMultiDay = end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000

                  if (isMultiDay) {
                    // Multi-day job: show date range
                    return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
                  } else {
                    // Same day: show date with times
                    return `${format(start, 'MMM d, yyyy • h:mm a')} – ${format(end, 'h:mm a')}`
                  }
                })()}
              </dd>
            </div>
          )}
          {jobLog.location && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">
                Location
              </dt>
              <dd className="text-sm text-primary-light/90 mt-1">{jobLog.location}</dd>
            </div>
          )}
          {jobLog.contact && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">
                Contact
              </dt>
              <dd className="text-sm text-primary-light/90 mt-1">
                {jobLog.contact.name}
                {jobLog.contact.email && (
                  <span className="text-primary-light/60"> · {jobLog.contact.email}</span>
                )}
              </dd>
            </div>
          )}
          {primaryPrice != null && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">
                Price
              </dt>
              <dd className="text-sm text-primary-gold font-semibold mt-1">
                $
                {primaryPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Tabbed tools: Notes | Clock | Photos */}
      <div className="pt-4">
        <div className="flex gap-1 border-b border-primary-blue mb-4">
          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              activeTab === 'notes'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/60 hover:text-primary-light'
            )}
          >
            Notes
          </button>
          <button
            onClick={() => setActiveTab('clock')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              activeTab === 'clock'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/60 hover:text-primary-light'
            )}
          >
            Clock
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              activeTab === 'photos'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/60 hover:text-primary-light'
            )}
          >
            Photos
          </button>
        </div>

        {activeTab === 'clock' && (
          <TimeTracker
            jobLogId={jobLog.id}
            jobLogTitle={jobLog.title}
            timeEntries={jobLog.timeEntries ?? []}
            isAdmin={user?.role === 'admin' || user?.role === 'owner'}
            currentUserId={user?.id}
            assignedTo={parsedAssignments}
            externalTimerState={{
              isRunning: isTimerRunning,
              start: timerStart,
              elapsed: elapsedSeconds,
              onStart: handleStartTimer,
              onStop: handleStopTimer,
            }}
          />
        )}

        {activeTab === 'photos' && (
          <PhotoCapture jobLogId={jobLog.id} photos={jobLog.photos ?? []} />
        )}

        {activeTab === 'notes' && (
          <JobLogNotes jobLogId={jobLog.id} initialNotes={jobLog.notes ?? ''} />
        )}
      </div>
    </div>
  )
}

export default JobLogDetail
