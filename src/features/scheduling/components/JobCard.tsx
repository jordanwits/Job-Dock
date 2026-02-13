import { format } from 'date-fns'
import { useJobStore } from '../store/jobStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Job, JobAssignment } from '../types/job'
import { useAuthStore } from '@/features/auth/store/authStore'

interface JobCardProps {
  job: Job
  showCreatedBy?: boolean
}

const JobCard = ({ job, showCreatedBy }: JobCardProps) => {
  const { setSelectedJob } = useJobStore()
  const { user } = useAuthStore()
  
  // Parse assignments from job (handle both old and new formats)
  const getAssignments = (): JobAssignment[] => {
    if (!job.assignedTo) return []
    if (Array.isArray(job.assignedTo)) {
      if (job.assignedTo.length > 0 && typeof job.assignedTo[0] === 'object' && 'userId' in job.assignedTo[0]) {
        return job.assignedTo as JobAssignment[]
      }
      return (job.assignedTo as string[]).map(id => ({ userId: id, role: 'Team Member', price: null }))
    }
    return [{ userId: job.assignedTo as string, role: 'Team Member', price: null }]
  }
  
  const assignments = getAssignments()
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  const currentUserId = user?.id
  
  // Calculate display price based on user role
  const getDisplayPrice = (): number | null => {
    // If job has a total price, show it for admins/owners
    if (job.price != null && isAdminOrOwner) {
      return job.price
    }
    
    // For employees, show their assignment price if assigned
    if (user?.role === 'employee' && currentUserId && assignments.length > 0) {
      const userAssignment = assignments.find(a => a.userId === currentUserId)
      if (userAssignment && userAssignment.price != null && userAssignment.price !== undefined) {
        return userAssignment.price
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
      if (total > 0) return total
    }
    
    // Fallback to job price
    return job.price ?? null
  }
  
  const displayPrice = getDisplayPrice()

  const statusColors = {
    scheduled: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    'in-progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    'pending-confirmation': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  const statusLabels = {
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
      onClick={() => setSelectedJob(job)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-lg font-semibold text-primary-light">
              {job.title}
              {isArchived && (
                <span className="text-primary-light/60 ml-2">• Archived</span>
              )}
            </h3>
            {subtitle && (
              <p className="text-xs text-primary-light/50 mt-1">{subtitle}</p>
            )}
            {hasAssignee && (
              <span className="text-xs text-primary-light/60 mt-1 block">
                Assigned to {job.assignedToName}
              </span>
            )}
            {showCreatedBy && job.createdByName && (
              <span className="text-xs text-primary-light/60 mt-1 block">
                Created by {job.createdByName}
              </span>
            )}
          </div>
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border flex-shrink-0',
              statusColors[job.status]
            )}
          >
            {statusLabels[job.status]}
          </span>
        </div>

        {/* Scheduled Time */}
        <div className="text-sm text-primary-light/70">
          {job.startTime
            ? format(new Date(job.startTime), 'MMM d, h:mm a')
            : 'To be scheduled'}
        </div>

        {/* Total / Price */}
        <div className="pt-2 border-t border-primary-blue">
          <div className="flex justify-between items-center">
            <span className="text-sm text-primary-light/70">
              {displayPrice != null ? 'Price' : 'Scheduled'}
            </span>
            <span className="text-xl font-bold text-primary-gold">
              {displayPrice != null
                ? formatCurrency(displayPrice)
                : job.startTime
                  ? format(new Date(job.startTime), 'h:mm a')
                  : '—'}
            </span>
          </div>
        </div>

        {/* Service */}
        {job.serviceName && (
          <div className="text-xs text-primary-light/50">
            {job.serviceName}
          </div>
        )}
      </div>
    </Card>
  )
}

export default JobCard
