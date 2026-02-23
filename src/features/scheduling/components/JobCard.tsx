import { format } from 'date-fns'
import { useJobStore } from '../store/jobStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Job, JobAssignment } from '../types/job'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useTheme } from '@/contexts/ThemeContext'

interface JobCardProps {
  job: Job
  showCreatedBy?: boolean
  onClick?: (job: Job) => void
}

const JobCard = ({ job, showCreatedBy, onClick }: JobCardProps) => {
  const { setSelectedJob } = useJobStore()
  const { user } = useAuthStore()
  const { theme } = useTheme()

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

  const getStatusColors = (status: string) => {
    const baseColors: Record<string, { dark: string; light: string }> = {
      active: {
        dark: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
        light: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      scheduled: {
        dark: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
        light: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      'in-progress': {
        dark: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        light: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      },
      completed: {
        dark: 'bg-green-500/20 text-green-400 border-green-500/30',
        light: 'bg-green-100 text-green-700 border-green-300',
      },
      cancelled: {
        dark: 'bg-red-500/20 text-red-400 border-red-500/30',
        light: 'bg-red-100 text-red-700 border-red-300',
      },
      'pending-confirmation': {
        dark: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        light: 'bg-orange-100 text-orange-700 border-orange-300',
      },
    }
    return baseColors[status]?.[theme] || baseColors.active[theme]
  }

  const statusLabels = {
    active: 'Active',
    scheduled: 'Scheduled',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'pending-confirmation': 'Pending Confirmation',
  }

  const isArchived = !!job.archivedAt

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const subtitle = [job.contactName, job.location].filter(Boolean).join(' • ')
  const hasAssignee = !!job.assignedToName

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-colors',
        isArchived && 'opacity-75'
      )}
      onClick={() => {
        if (onClick) {
          onClick(job)
        } else {
          setSelectedJob(job)
        }
      }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>
              {job.title}
              {isArchived && (
                <span className={cn(
                  "ml-2",
                  theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                )}>• Archived</span>
              )}
            </h3>
            {subtitle && (
              <p className={cn(
                "text-xs mt-1",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>{subtitle}</p>
            )}
            {hasAssignee && (
              <span className={cn(
                "text-xs mt-1 block",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                Assigned to {job.assignedToName}
              </span>
            )}
            {showCreatedBy && job.createdByName && (
              <span className={cn(
                "text-xs mt-1 block",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                Created by {job.createdByName}
              </span>
            )}
          </div>
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border flex-shrink-0',
              getStatusColors(job.status)
            )}
          >
            {statusLabels[job.status]}
          </span>
        </div>

        {/* Scheduled Time */}
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-primary-gold flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-base font-semibold text-primary-gold">
            {job.startTime ? format(new Date(job.startTime), 'MMM d, h:mm a') : 'To be scheduled'}
          </span>
        </div>

        {/* Total / Price */}
        <div className={cn(
          "pt-2 border-t",
          theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
        )}>
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-sm",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>
              {displayPrice != null || !canSeeJobPrices ? 'Price' : 'Scheduled'}
            </span>
            <span
              className={cn(
                "text-xl font-bold",
                displayPrice == null && !canSeeJobPrices 
                  ? theme === 'dark' ? 'text-primary-light/40' : 'text-primary-lightTextSecondary/60'
                  : 'text-primary-gold'
              )}
            >
              {displayPrice == null && !canSeeJobPrices && job.price != null ? (
                <span className="text-xs italic">Insufficient permissions</span>
              ) : displayPriceResult != null ? (
                <>
                  {formatCurrency(displayPriceResult.value)}
                  {displayPriceResult.isHourly && (
                    <span className={cn(
                      "text-sm font-normal",
                      theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
                    )}>/hr</span>
                  )}
                </>
              ) : job.startTime ? (
                format(new Date(job.startTime), 'h:mm a')
              ) : (
                '—'
              )}
            </span>
          </div>
        </div>

        {/* Service */}
        {job.serviceName && (
          <div className={cn(
            "text-xs",
            theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
          )}>{job.serviceName}</div>
        )}
      </div>
    </Card>
  )
}

export default JobCard
