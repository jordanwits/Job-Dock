import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { jobsService } from '@/lib/api/services'
import type { Job } from '../types/job'
import {
  Alert,
  AppButton,
  ArchiveIcon,
  CalendarIcon,
  EmptyState,
  RefreshIcon,
  Spinner,
  StatusBadge,
  TrashIcon,
  UserIcon,
} from './schedulingUi'
import { resolveJobStatus } from './schedulingStatus'

interface ArchivedJobsPageProps {
  onJobRestore: (job: Job) => Promise<void>
  onJobSelect?: (job: Job) => void
  onPermanentDelete?: (job: Job) => void
  deletedJobId?: string | null
  deletedRecurrenceId?: string | null
}

const ArchivedJobsPage = ({ onJobRestore, onJobSelect, onPermanentDelete, deletedJobId, deletedRecurrenceId }: ArchivedJobsPageProps) => {
  const [archivedJobs, setArchivedJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchArchivedJobs()
  }, [])

  // Remove deleted jobs from the list
  useEffect(() => {
    if (deletedJobId) {
      setArchivedJobs(prev => prev.filter(j => j.id !== deletedJobId))
    }
  }, [deletedJobId])

  useEffect(() => {
    if (deletedRecurrenceId) {
      setArchivedJobs(prev => prev.filter(j => j.recurrenceId !== deletedRecurrenceId))
    }
  }, [deletedRecurrenceId])

  const fetchArchivedJobs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch archived jobs - use wide date range to include both past and future jobs
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
      const twoYearsFromNow = new Date()
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2)

      console.log('ArchivedJobsPage: Fetching with date range:', {
        start: twoYearsAgo.toISOString(),
        end: twoYearsFromNow.toISOString(),
        includeArchived: true
      })
      const jobs = await jobsService.getAll(twoYearsAgo, twoYearsFromNow, true, false) // includeArchived = true

      console.log('ArchivedJobsPage: Fetched jobs:', jobs.length, jobs)
      // Filter to only show archived jobs
      const archived = jobs.filter((job: Job) => {
        console.log('ArchivedJobsPage: Job', job.id, 'archivedAt:', job.archivedAt)
        return job.archivedAt
      })
      console.log('ArchivedJobsPage: Filtered archived jobs:', archived.length, archived)
      setArchivedJobs(archived)
    } catch (err: any) {
      console.error('ArchivedJobsPage: Error fetching archived jobs:', err)
      setError(err.message || 'Failed to fetch archived jobs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (job: Job) => {
    try {
      await onJobRestore(job)
      // Remove from list after successful restore
      setArchivedJobs(prev => prev.filter(j => j.id !== job.id))
    } catch (err) {
      console.error('Failed to restore job:', err)
    }
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Archived jobs</h2>
        <p className="mt-1 text-sm text-ink-muted">
          These will be moved to long-term storage after 30 days. Restore any job back to your active calendar.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted">
            <Spinner />
            Loading archived jobs...
          </div>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        {!isLoading && !error && archivedJobs.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<ArchiveIcon className="h-10 w-10" />}
              title="No archived jobs found. Archived jobs will appear here."
            />
          </div>
        )}

        {!isLoading && !error && archivedJobs.length > 0 && (
          <div className="h-full space-y-3 overflow-y-auto pr-1">
            {archivedJobs.map((job) => {
              const status = resolveJobStatus(job.status)
              return (
                <div
                  key={job.id}
                  onClick={() => onJobSelect?.(job)}
                  className="cursor-pointer rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="truncate font-semibold text-ink">{job.title}</h3>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </div>

                      {job.description && (
                        <p className="mb-2 line-clamp-1 text-sm text-ink-muted">{job.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-subtle">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-4 w-4" />
                          {job.startTime ? (
                            <span className="font-mono tabular-nums">{format(new Date(job.startTime), 'MMM d, yyyy')}</span>
                          ) : (
                            <span className="text-warning">To be scheduled</span>
                          )}
                        </div>

                        {job.contactName && (
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="h-4 w-4" />
                            <span className="truncate">{job.contactName}</span>
                          </div>
                        )}

                        {job.archivedAt && (
                          <div className="flex items-center gap-1.5">
                            <ArchiveIcon className="h-4 w-4" />
                            <span>
                              Archived{' '}
                              <span className="font-mono tabular-nums">{format(new Date(job.archivedAt), 'MMM d, yyyy')}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {onPermanentDelete && (
                        <AppButton
                          variant="dangerGhost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPermanentDelete(job)
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete forever
                        </AppButton>
                      )}
                      <AppButton
                        variant="subtle"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestore(job)
                        }}
                      >
                        <RefreshIcon className="h-4 w-4" />
                        Restore
                      </AppButton>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ArchivedJobsPage
