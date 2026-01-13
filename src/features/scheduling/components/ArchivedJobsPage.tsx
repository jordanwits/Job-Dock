import { useState, useEffect } from 'react'
import { Button, Card } from '@/components/ui'
import { format } from 'date-fns'
import { jobsService } from '@/lib/api/services'
import type { Job } from '../types/job'
import { cn } from '@/lib/utils'

interface ArchivedJobsPageProps {
  onJobRestore: (job: Job) => Promise<void>
  onJobSelect?: (job: Job) => void
}

const ArchivedJobsPage = ({ onJobRestore, onJobSelect }: ArchivedJobsPageProps) => {
  const [archivedJobs, setArchivedJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchArchivedJobs()
  }, [])

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

  const statusColors = {
    scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'in-progress': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
    'pending-confirmation': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary-gold">Archived Jobs</h2>
          <p className="text-sm text-primary-light/70 mt-1">
            These will be moved to long-term storage after 30 days. Restore any job back to your active calendar.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-primary-light/70">Loading archived jobs...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {!isLoading && !error && archivedJobs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-20 h-20 mb-4 text-primary-light/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-xl text-primary-light/50 mb-2">No archived jobs found</p>
            <p className="text-sm text-primary-light/40">Archived jobs will appear here</p>
          </div>
        )}

        {!isLoading && !error && archivedJobs.length > 0 && (
          <div className="h-full overflow-y-auto space-y-3 pr-2">
            {archivedJobs.map((job) => (
              <Card
                key={job.id}
                className="hover:border-primary-gold/50 transition-all cursor-pointer"
                onClick={() => onJobSelect?.(job)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-primary-light truncate">
                        {job.title}
                      </h3>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0',
                          statusColors[job.status]
                        )}
                      >
                        {job.status}
                      </span>
                    </div>

                    {job.description && (
                      <p className="text-sm text-primary-light/70 mb-2 line-clamp-1">
                        {job.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary-light/60">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{format(new Date(job.startTime), 'MMM d, yyyy')}</span>
                      </div>

                      {job.contactName && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="truncate">{job.contactName}</span>
                        </div>
                      )}

                      {job.archivedAt && (
                        <div className="flex items-center gap-1.5 text-primary-light/40">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archived {format(new Date(job.archivedAt), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRestore(job)
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Restore
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ArchivedJobsPage
