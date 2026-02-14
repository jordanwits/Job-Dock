import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Card, Button, StatusBadgeSelect } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth'
import type { JobLog, JobAssignment } from '../types/jobLog'
import JobLogForm from './JobLogForm'
import TimeTracker from './TimeTracker'
import PhotoCapture from './PhotoCapture'
import JobLogNotes from './JobLogNotes'

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
  const [activeTab, setActiveTab] = useState<Tab>('notes')
  const [showMenu, setShowMenu] = useState(false)
  const canAccessQuotes = user?.role !== 'employee'

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
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onEdit()
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-primary-light hover:bg-primary-blue/20"
                >
                  Edit
                </button>
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
                value={jobLog.status === 'archived' ? 'inactive' : jobLog.status || 'active'}
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
                    (jobLog.status === 'archived' ? 'inactive' : jobLog.status) || 'active'
                  ]
                )}
              >
                {jobLog.status === 'archived' ? 'Inactive' : jobLog.status || 'Active'}
              </span>
            )}
            <span className="text-sm text-primary-light/50 shrink-0">
              {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
            </span>
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
                              isAdminOrOwner || assignment.userId === currentUserId
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
                                  hasPayInfo
                                    ? 'flex-row gap-3 px-2 py-1.5'
                                    : 'px-2 py-1'
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
        {/* Desktop: inline buttons */}
        <div className="hidden sm:flex flex-wrap gap-2 shrink-0">
          {canAccessQuotes && (
            <Button variant="outline" size="sm" onClick={handleCreateQuote}>
              Create Quote
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleScheduleAppointment}>
            Schedule Appointment
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 border-red-500/50 hover:bg-red-500/10"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Overview: contact and location */}
      {hasOverview && (
        <dl className="space-y-3">
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
