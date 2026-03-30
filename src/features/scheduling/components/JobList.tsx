import { useEffect, useMemo, useState } from 'react'
import { useJobStore } from '../store/jobStore'
import type { Job } from '../types/job'
import JobCard from './JobCard'
import { getUpcomingBookingListInstant } from '../utils/upcomingBookingDisplay'
import { startOfMonth, endOfMonth, addMonths, addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

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
  const { theme } = useTheme()

  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week')

  // Fetch active jobs only
  useEffect(() => {
    const startDate = startOfMonth(currentDate)
    const endDate = endOfMonth(addMonths(currentDate, 1))
    fetchJobs(startDate, endDate, false, false) // active only, no archived
  }, [currentDate, fetchJobs])

  // Upcoming active jobs: multi-day jobs use the next in-range calendar day (one row per job).
  const filteredJobs = useMemo(() => {
    const now = new Date()
    let windowEnd: Date

    switch (timeFrame) {
      case 'day':
        windowEnd = addDays(now, 1)
        break
      case 'week':
        windowEnd = addDays(now, 7)
        break
      case 'month':
        windowEnd = addDays(now, 30)
        break
      default:
        windowEnd = addDays(now, 7)
    }

    const entries: { job: Job; displayAt: Date }[] = []
    for (const job of jobs) {
      if (!job.startTime) continue
      const displayAt = getUpcomingBookingListInstant(job, now)
      if (!displayAt || displayAt.getTime() > windowEnd.getTime()) continue
      entries.push({ job, displayAt })
    }

    return entries.sort((a, b) => a.displayAt.getTime() - b.displayAt.getTime())
  }, [jobs, timeFrame])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className={cn(
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>Loading jobs...</div>
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
              : theme === 'dark'
                ? 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
                : 'bg-gray-100 text-primary-lightText hover:bg-gray-200'
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
              : theme === 'dark'
                ? 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
                : 'bg-gray-100 text-primary-lightText hover:bg-gray-200'
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
              : theme === 'dark'
                ? 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
                : 'bg-gray-100 text-primary-lightText hover:bg-gray-200'
          )}
        >
          Month
        </button>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="p-6 text-center">
            <p className={cn(
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>
              No upcoming jobs scheduled for the next {timeFrame}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(({ job, displayAt }) => (
              <JobCard 
                key={job.id} 
                job={job}
                scheduledDisplayAt={displayAt}
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

