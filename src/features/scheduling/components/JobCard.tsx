import { format } from 'date-fns'
import { useJobStore } from '../store/jobStore'
import type { Job, JobAssignment } from '../types/job'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/store/authStore'
import { CalendarIcon, StatusBadge } from './schedulingUi'
import { resolveJobStatus } from './schedulingStatus'

interface JobCardProps {
  job: Job
  /** When set (e.g. multi-day “next day” in upcoming lists), shown instead of `job.startTime`. */
  scheduledDisplayAt?: Date
  showCreatedBy?: boolean
  onClick?: (job: Job) => void
}

const JobCard = ({ job, scheduledDisplayAt, showCreatedBy, onClick }: JobCardProps) => {
  const { setSelectedJob } = useJobStore()
  const { user } = useAuthStore()

  // Parse assignments from job (handle both old and new formats)
  const getAssignments = (): JobAssignment[] => {
    if (!job.assignedTo) return []
    if (Array.isArray(job.assignedTo)) {
      if (
        job.assignedTo.length > 0 &&
        typeof job.assignedTo[0] === 'object' &&
        'userId' in job.assignedTo[0]
      ) {
        return job.assignedTo as JobAssignment[]
      }
      return (job.assignedTo as string[]).map(id => ({
        userId: id,
        role: 'Team Member',
        price: null,
      }))
    }
    return [{ userId: job.assignedTo as string, role: 'Team Member', price: null }]
  }

  const assignments = getAssignments()
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  const currentUserId = user?.id
  const canSeeJobPrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)

  // Calculate display price based on user role and permissions
  const getDisplayPrice = (): { value: number; isHourly?: boolean } | null => {
    // If job has a total price, show it for admins/owners
    if (job.price != null && isAdminOrOwner) {
      return { value: job.price }
    }

    // For employees, show their assignment pay if assigned (even if canSeeJobPrices is false)
    // Show job price or hourly rate so they can see their pay whether by hour or job
    if (user?.role === 'employee' && currentUserId && assignments.length > 0) {
      const userAssignment = assignments.find(a => a.userId === currentUserId)
      if (userAssignment) {
        if (
          userAssignment.payType === 'hourly' &&
          userAssignment.hourlyRate != null &&
          userAssignment.hourlyRate !== undefined
        ) {
          return { value: userAssignment.hourlyRate, isHourly: true }
        }
        if (userAssignment.price != null && userAssignment.price !== undefined) {
          return { value: userAssignment.price }
        }
      }
    }

    // For admins/owners with assignments, show total of all assignment prices
    if (isAdminOrOwner && assignments.length > 0) {
      const total = assignments.reduce((sum, a) => {
        if (a.price != null && a.price !== undefined) {
          return sum + a.price
        }
        return sum
      }, 0)
      if (total > 0) return { value: total }
    }

    // Show job price only if user has permission
    if (canSeeJobPrices && job.price != null) {
      return { value: job.price }
    }

    return null
  }

  const displayPriceResult = getDisplayPrice()
  const displayPrice = displayPriceResult?.value ?? null

  const { label: statusLabel, tone: statusTone } = resolveJobStatus(job.status)

  const isArchived = !!job.archivedAt

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const subtitle = [job.contactName, job.location].filter(Boolean).join(' • ')
  const hasAssignee = !!job.assignedToName
  const scheduleAt = scheduledDisplayAt ?? (job.startTime ? new Date(job.startTime) : null)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (onClick) {
          onClick(job)
        } else {
          setSelectedJob(job)
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (onClick) {
            onClick(job)
          } else {
            setSelectedJob(job)
          }
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-xl bg-surface p-5 shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent',
        isArchived && 'opacity-75'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">
            {job.title}
            {isArchived && <span className="ml-2 text-ink-subtle">• Archived</span>}
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-ink-muted">{subtitle}</p>}
          {hasAssignee && (
            <span className="mt-1 block text-xs text-ink-subtle">Assigned to {job.assignedToName}</span>
          )}
          {showCreatedBy && job.createdByName && (
            <span className="mt-1 block text-xs text-ink-subtle">Created by {job.createdByName}</span>
          )}
        </div>
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
      </div>

      {/* Scheduled Time */}
      <div className="mt-4 flex items-center gap-2 text-accent-strong">
        <CalendarIcon className="h-4 w-4 shrink-0" />
        <span className="font-mono text-sm font-semibold tabular-nums">
          {scheduleAt ? format(scheduleAt, 'MMM d, h:mm a') : 'To be scheduled'}
        </span>
      </div>

      {/* Total / Price */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[13px] text-ink-muted">
          {displayPrice != null || !canSeeJobPrices ? 'Price' : 'Scheduled'}
        </span>
        <span
          className={cn(
            'font-mono text-xl font-semibold tabular-nums',
            displayPrice == null && !canSeeJobPrices ? 'text-ink-subtle' : 'text-ink'
          )}
        >
          {displayPrice == null && !canSeeJobPrices && job.price != null ? (
            <span className="text-xs italic">Insufficient permissions</span>
          ) : displayPriceResult != null ? (
            <>
              {formatCurrency(displayPriceResult.value)}
              {displayPriceResult.isHourly && (
                <span className="text-sm font-normal text-ink-muted">/hr</span>
              )}
            </>
          ) : scheduleAt ? (
            format(scheduleAt, 'h:mm a')
          ) : (
            '—'
          )}
        </span>
      </div>

      {/* Service */}
      {job.serviceName && <div className="mt-2 text-xs text-ink-subtle">{job.serviceName}</div>}
    </div>
  )
}

export default JobCard
