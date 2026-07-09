import { format, parseISO } from 'date-fns'
import { useJobStore } from '../store/jobStore'
import type { Job, JobAssignment } from '../types/job'
import { cn, getMapsHref } from '@/lib/utils'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppButton,
  AppModal,
  ArchiveIcon,
  ChevronDownIcon,
  ClockIcon,
  RefreshIcon,
  StatusBadge,
  TrashIcon,
  linkCls,
} from './schedulingUi'
import { resolveJobStatus } from './schedulingStatus'

interface JobDetailProps {
  job: Job
  isOpen: boolean
  onClose: () => void
  showCreatedBy?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onPermanentDelete?: () => void
  onRestore?: () => void
  onConfirm?: () => void
  onDecline?: () => void
  onScheduleFollowup?: () => void
  onScheduleJob?: () => void
}

const JobDetail = ({ job, isOpen, onClose, onEdit, onDelete, onPermanentDelete, onRestore, onConfirm, onDecline, onScheduleFollowup, onScheduleJob, showCreatedBy }: JobDetailProps) => {
  const navigate = useNavigate()
  const { quotes, fetchQuotes } = useQuoteStore()
  const { invoices, fetchInvoices } = useInvoiceStore()
  const { user } = useAuthStore()
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)

  // Parse assignments from job (handle both old and new formats)
  const getAssignments = (): JobAssignment[] => {
    if (!job.assignedTo) return []
    if (Array.isArray(job.assignedTo)) {
      if (job.assignedTo.length > 0 && typeof job.assignedTo[0] === 'object' && 'userId' in job.assignedTo[0]) {
        return job.assignedTo as JobAssignment[]
      }
      // Old format: array of strings
      return (job.assignedTo as string[]).map(id => ({ userId: id, role: 'Team Member', price: null }))
    }
    // Old format: single string
    return [{ userId: job.assignedTo as string, role: 'Team Member', price: null }]
  }

  const assignments = getAssignments()
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  const currentUserId = user?.id
  const canSeeJobPrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)
  const canEditJobs = (() => {
    if (!user) return true
    if (isAdminOrOwner) return true
    if (user.canEditJobs === false) return false
    if (user.canEditAssignedJobsOnly !== false) {
      if (job.createdById === user.id) return true
      try {
        const raw = job.assignedTo
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(arr)) return arr.some((a: any) => a.userId === user.id)
      } catch {}
      return false
    }
    return true
  })()

  useEffect(() => {
    if (job?.quoteId && quotes.length === 0) {
      fetchQuotes()
    }
    if (job?.invoiceId && invoices.length === 0) {
      fetchInvoices()
    }
  }, [job, quotes.length, invoices.length, fetchQuotes, fetchInvoices])

  const linkedQuote = job.quoteId ? quotes.find(q => q.id === job.quoteId) : null
  const linkedInvoice = job.invoiceId ? invoices.find(i => i.id === job.invoiceId) : null

  const { label: statusLabel, tone: statusTone } = resolveJobStatus(job.status)

  const isArchived = !!job.archivedAt
  const isUnscheduled = job.toBeScheduled || !job.startTime || !job.endTime
  // Staged monthly series (virtual per-month chip, or legacy staged placeholder).
  const isStagedSeries = !!job.isStagedSeries || !!(job.toBeScheduled && job.recurrenceId)
  const isIndependent = !!(job as { isIndependent?: boolean }).isIndependent

  // Detect if this is a multi-day job
  const startTime = job.startTime ? new Date(job.startTime) : null
  const endTime = job.endTime ? new Date(job.endTime) : null
  const durationMs = (startTime && endTime) ? (endTime.getTime() - startTime.getTime()) : 0
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  const sectionHeaderCls = 'text-[11px] font-semibold uppercase tracking-wide text-ink-subtle'
  const subPanelCls = 'rounded-xl border border-line bg-surface-2 p-4'

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Job details"
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          {/* Primary actions */}
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {isUnscheduled && onScheduleJob && !isArchived && (
              <AppButton onClick={onScheduleJob} fullWidth className="sm:w-auto">
                Schedule job
              </AppButton>
            )}
            {!isUnscheduled && onScheduleFollowup && !isArchived && job.status !== 'pending-confirmation' && (
              <AppButton onClick={onScheduleFollowup} fullWidth className="sm:w-auto">
                Schedule follow-up
              </AppButton>
            )}
            <AppButton
              variant="subtle"
              onClick={() => {
                onClose()
                navigate(`/app/job-logs/${job.id}`)
              }}
              fullWidth
              className="sm:w-auto"
            >
              Details
            </AppButton>
          </div>

          {/* Secondary actions */}
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {isArchived ? (
              // Archived job actions
              <>
                {onRestore && (
                  <AppButton variant="subtle" onClick={onRestore} fullWidth className="sm:w-auto">
                    <RefreshIcon className="h-4 w-4" />
                    Restore
                  </AppButton>
                )}
                {onPermanentDelete && (
                  <AppButton variant="dangerGhost" onClick={onPermanentDelete} fullWidth className="sm:w-auto">
                    <TrashIcon className="h-4 w-4" />
                    Delete forever
                  </AppButton>
                )}
              </>
            ) : job.status === 'pending-confirmation' ? (
              // Pending confirmation actions
              <>
                {onDecline && (
                  <AppButton variant="dangerGhost" onClick={onDecline} fullWidth className="sm:w-auto">
                    Decline
                  </AppButton>
                )}
                {onConfirm && (
                  <AppButton onClick={onConfirm} fullWidth className="sm:w-auto">
                    Confirm booking
                  </AppButton>
                )}
              </>
            ) : (
              // Normal job actions - compact with dropdown
              <>
                {(onDelete || onPermanentDelete) && (
                  <div className="relative w-full sm:w-auto">
                    <AppButton
                      variant="dangerGhost"
                      onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                      fullWidth
                      className="sm:w-auto"
                    >
                      Delete
                      <ChevronDownIcon className="h-4 w-4" />
                    </AppButton>
                    {showDeleteMenu && (
                      <>
                        {/* Backdrop to close menu */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowDeleteMenu(false)} />
                        <div className="absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line">
                          {onDelete && (
                            <button
                              onClick={() => {
                                setShowDeleteMenu(false)
                                onDelete()
                              }}
                              className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                            >
                              <ArchiveIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-subtle transition-colors group-hover:text-ink" />
                              <div>
                                <div className="font-medium">Archive</div>
                                <div className="mt-0.5 text-xs text-ink-subtle">Can be restored later</div>
                              </div>
                            </button>
                          )}
                          {onPermanentDelete && (
                            <>
                              {onDelete && <div className="my-1 border-t border-line" />}
                              <button
                                onClick={() => {
                                  setShowDeleteMenu(false)
                                  onPermanentDelete()
                                }}
                                className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                              >
                                <TrashIcon className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                  <div className="font-medium">Delete permanently</div>
                                  <div className="mt-0.5 text-xs text-danger/70">Cannot be undone</div>
                                </div>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {onEdit && !isArchived && canEditJobs && (
                  <AppButton variant="subtle" onClick={onEdit} fullWidth className="sm:w-auto">
                    Edit
                  </AppButton>
                )}
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-ink">{job.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
              {showCreatedBy && job.createdByName && (
                <span className="inline-flex items-center rounded-full bg-info-soft px-2.5 py-0.5 text-[11px] font-semibold text-info">
                  Created by {job.createdByName}
                </span>
              )}
              {isArchived && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  <ArchiveIcon className="h-3.5 w-3.5" />
                  Archived{' '}
                  <span className="font-mono tabular-nums">{format(new Date(job.archivedAt!), 'MMM d, yyyy')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {job.description && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{job.description}</p>
          </div>
        )}

        {/* Schedule */}
        <div className="grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-2">
          {isUnscheduled ? (
            <div className={cn(subPanelCls, 'sm:col-span-2')}>
              <h3 className={sectionHeaderCls}>Schedule</h3>
              <p className="mt-1.5 flex items-center gap-2 text-base text-warning">
                <ClockIcon className="h-5 w-5" />
                {isStagedSeries
                  ? job.stagedTargetMonth
                    ? `Monthly — schedule ${format(parseISO(`${job.stagedTargetMonth}-01`), 'MMMM yyyy')}`
                    : 'Monthly — to be scheduled'
                  : 'To be scheduled'}
              </p>
              <p className="mt-1 text-sm text-ink-subtle">
                {isStagedSeries
                  ? 'Pins to the top of the calendar each month until you schedule it.'
                  : 'Drag to calendar to schedule'}
              </p>
            </div>
          ) : isMultiDay ? (
            <div className={cn(subPanelCls, 'sm:col-span-2')}>
              <h3 className={sectionHeaderCls}>Schedule</h3>
              <p className="mt-1.5 font-mono text-base tabular-nums text-ink">
                {format(startTime!, 'MMM d, yyyy')} – {format(endTime!, 'MMM d, yyyy')}
              </p>
              <p className="mt-1 text-sm text-ink-subtle">All-day job</p>
            </div>
          ) : (
            <>
              <div className={subPanelCls}>
                <h3 className={sectionHeaderCls}>Start time</h3>
                <p className="mt-1.5 font-mono text-sm tabular-nums text-ink">
                  {format(startTime!, 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div className={subPanelCls}>
                <h3 className={sectionHeaderCls}>End time</h3>
                <p className="mt-1.5 font-mono text-sm tabular-nums text-ink">
                  {format(endTime!, 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Contact */}
        <div className="border-t border-line pt-6">
          <h3 className={sectionHeaderCls}>Contact</h3>
          <div className="mt-1 space-y-1">
            {job.contactName ? (
              <>
                <p className="text-sm font-medium text-ink">{job.contactName}</p>
                {job.contactEmail && <p className="text-sm text-ink-muted">{job.contactEmail}</p>}
                {job.contactPhone && (
                  <p className="font-mono text-sm tabular-nums text-ink-muted">{job.contactPhone}</p>
                )}
              </>
            ) : (
              <p className="text-sm italic text-ink-subtle">Contact information not available</p>
            )}
          </div>
        </div>

        {/* Assigned to */}
        {assignments.length > 0 && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Assigned to</h3>
            <div className="mt-2 max-w-md space-y-2">
              {assignments.map((assignment, index) => {
                // Find name from assignedToName by index (approximate match)
                const nameParts = job.assignedToName?.split(',') || []
                const nameFromString = nameParts[index]?.trim()
                // Show "Unassigned" instead of "User 1", "User 2", etc. when name is not available
                const displayName = nameFromString || 'Unassigned'
                // Employees can always see their own assignment pay (hourly or job), even if canSeeJobPrices is false
                // Admins/owners can see all prices if canSeeJobPrices is true
                const canSeePrice = isAdminOrOwner ? canSeeJobPrices : (assignment.userId === currentUserId)
                const price = canSeePrice ? assignment.price : undefined
                const hourlyRate = canSeePrice ? assignment.hourlyRate : undefined
                const payType = assignment.payType || 'job'
                const hasJobPrice = payType === 'job' && price !== null && price !== undefined
                const hasHourlyRate = payType === 'hourly' && hourlyRate !== null && hourlyRate !== undefined
                const hasPayInfo = hasJobPrice || hasHourlyRate
                return (
                  <div
                    key={assignment.userId || index}
                    className={cn(
                      'flex items-center rounded-xl border border-line bg-surface-2',
                      hasPayInfo ? 'justify-between gap-3 px-3 py-2' : 'inline-flex px-3 py-1.5'
                    )}
                  >
                    <div className="min-w-0 flex-shrink">
                      <span className="text-sm font-medium text-ink">{displayName}</span>
                      {assignment.role && assignment.role !== 'Team Member' && (
                        <span className="ml-2 text-sm text-ink-muted">({assignment.role})</span>
                      )}
                    </div>
                    {hasPayInfo && (
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-accent-strong">
                        {hasJobPrice ? `$${price!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/job` : `$${hourlyRate!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {job.serviceName && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Service</h3>
            <p className="mt-1 text-sm text-ink">{job.serviceName}</p>
          </div>
        )}

        {/* Linked Quote or Invoice - hide for independent appointments */}
        {(linkedQuote || linkedInvoice) && !job.isIndependent && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Linked document</h3>
            <div className="mt-1">
              {linkedQuote && (
                <button
                  onClick={() => {
                    onClose()
                    navigate(`/app/quotes?open=${linkedQuote.id}`)
                  }}
                  className={cn(linkCls, 'text-sm')}
                >
                  Quote <span className="font-mono tabular-nums">{linkedQuote.quoteNumber}</span>
                  {linkedQuote.title && ` — ${linkedQuote.title}`}
                </button>
              )}
              {linkedInvoice && (
                <button
                  onClick={() => {
                    onClose()
                    navigate(`/app/invoices?open=${linkedInvoice.id}`)
                  }}
                  className={cn(linkCls, 'text-sm')}
                >
                  Invoice <span className="font-mono tabular-nums">{linkedInvoice.invoiceNumber}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {job.location && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Location</h3>
            <p className="mt-1 text-sm text-ink">
              <a
                href={getMapsHref(job.location)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkCls}
              >
                {job.location}
              </a>
            </p>
          </div>
        )}

        {job.price && canSeeJobPrices && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Price</h3>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-accent-strong">
              ${job.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* Job Timeline with Breaks */}
        {job.breaks && job.breaks.length > 0 && !isUnscheduled && startTime && endTime && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Job timeline</h3>
            <div className="mt-3 space-y-3">
              {(() => {
                // Build timeline segments
                const segments: Array<{ type: 'work' | 'break'; start: Date; end: Date; reason?: string }> = []
                const sortedBreaks = [...job.breaks].sort((a, b) =>
                  new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                )

                let currentTime = startTime

                sortedBreaks.forEach((breakItem) => {
                  const breakStart = new Date(breakItem.startTime)
                  const breakEnd = new Date(breakItem.endTime)

                  // Add work segment before break
                  if (currentTime < breakStart) {
                    segments.push({ type: 'work', start: currentTime, end: breakStart })
                  }

                  // Add break segment
                  segments.push({ type: 'break', start: breakStart, end: breakEnd, reason: breakItem.reason })

                  currentTime = breakEnd
                })

                // Add final work segment if there's time remaining
                if (currentTime < endTime) {
                  segments.push({ type: 'work', start: currentTime, end: endTime })
                }

                return segments.map((segment, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={cn(
                      'mt-2 h-2 w-2 shrink-0 rounded-full',
                      segment.type === 'work' ? 'bg-success' : 'bg-warning'
                    )} />
                    <div className="flex-1">
                      {segment.type === 'work' ? (
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {index === 0 ? 'Work starts' : 'Work resumes'}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-ink-muted">
                            {isMultiDay
                              ? `${format(segment.start, 'MMM d, yyyy')} – ${format(segment.end, 'MMM d, yyyy')}`
                              : `${format(segment.start, 'MMM d, h:mm a')} – ${format(segment.end, 'h:mm a')}`
                            }
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-warning">
                            Paused{segment.reason && `: ${segment.reason}`}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-ink-muted">
                            {isMultiDay
                              ? `${format(segment.start, 'MMM d')} – ${format(segment.end, 'MMM d, yyyy')}`
                              : `${format(segment.start, 'MMM d, h:mm a')} – ${format(segment.end, 'h:mm a')}`
                            }
                          </p>
                          {index === segments.length - 2 && (
                            <p className="mt-1 font-mono text-xs font-medium tabular-nums text-success">
                              → Returns {isMultiDay ? format(segment.end, 'MMM d, yyyy') : format(segment.end, 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        )}

        {job.notes && (
          <div className="border-t border-line pt-6">
            <h3 className={sectionHeaderCls}>Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{job.notes}</p>
          </div>
        )}
      </div>
    </AppModal>
  )
}

export default JobDetail
