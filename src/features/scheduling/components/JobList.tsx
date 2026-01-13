import { useEffect, useMemo } from 'react'
import { useJobStore } from '../store/jobStore'
import JobCard from './JobCard'
import { startOfMonth, endOfMonth, addMonths } from 'date-fns'

const JobList = () => {
  const {
    jobs,
    isLoading,
    currentDate,
    fetchJobs,
  } = useJobStore()

  // Fetch active jobs only
  useEffect(() => {
    const startDate = startOfMonth(currentDate)
    const endDate = endOfMonth(addMonths(currentDate, 1))
    fetchJobs(startDate, endDate, false, false) // active only, no archived
  }, [currentDate, fetchJobs])

  // Get filtered jobs - upcoming active jobs only
  const filteredJobs = useMemo(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return jobs
      .filter((job) => {
        const jobDate = new Date(job.startTime)
        // Active view - upcoming jobs only
        return jobDate >= today && jobDate <= nextWeek && job.status !== 'cancelled' && !job.archivedAt
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [jobs])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-primary-light/70">Loading jobs...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-primary-light/70">
              No upcoming jobs scheduled
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobList

