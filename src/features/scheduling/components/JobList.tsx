import { useEffect, useMemo, useState } from 'react'
import { useJobStore } from '../store/jobStore'
import type { Job } from '../types/job'
import JobCard from './JobCard'
import { startOfMonth, endOfMonth, addMonths, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

type TimeFrame = 'day' | 'week' | 'month'

interface JobListProps {
  showCreatedBy?: boolean
  onJobClick?: (job: Job) => void
}

const JobList = ({ showCreatedBy, onJobClick }: JobListProps) => {
  const {
    jobs,
    isLoading,
    currentDate,
    fetchJobs,
  } = useJobStore()

  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week')

  // Fetch active jobs only
  useEffect(() => {
    const startDate = startOfMonth(currentDate)
    const endDate = endOfMonth(addMonths(currentDate, 1))
    fetchJobs(startDate, endDate, false, false) // active only, no archived
  }, [currentDate, fetchJobs])

  // Get filtered jobs - upcoming active jobs only
  const filteredJobs = useMemo(() => {
    const today = new Date()
    let endDate: Date

    switch (timeFrame) {
      case 'day':
        endDate = addDays(today, 1)
        break
      case 'week':
        endDate = addDays(today, 7)
        break
      case 'month':
        endDate = addDays(today, 30)
        break
      default:
        endDate = addDays(today, 7)
    }

    return jobs
      .filter((job) => {
        // Exclude unscheduled jobs from this list
        if (job.toBeScheduled || !job.startTime) return false
        
        const jobDate = new Date(job.startTime)
        // Active view - upcoming jobs only
        return jobDate >= today && jobDate <= endDate && job.status !== 'cancelled' && !job.archivedAt
      })
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
  }, [jobs, timeFrame])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-primary-light/70">Loading jobs...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Time Frame Selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTimeFrame('day')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            timeFrame === 'day'
              ? 'bg-primary-gold text-primary-dark'
              : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
          )}
        >
          Day
        </button>
        <button
          onClick={() => setTimeFrame('week')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            timeFrame === 'week'
              ? 'bg-primary-gold text-primary-dark'
              : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
          )}
        >
          Week
        </button>
        <button
          onClick={() => setTimeFrame('month')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            timeFrame === 'month'
              ? 'bg-primary-gold text-primary-dark'
              : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
          )}
        >
          Month
        </button>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-primary-light/70">
              No upcoming jobs scheduled for the next {timeFrame}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <JobCard 
                key={job.id} 
                job={job} 
                showCreatedBy={showCreatedBy}
                onClick={onJobClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobList

