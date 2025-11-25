import { useEffect, useMemo } from 'react'
import { useJobStore } from '../store/jobStore'
import JobCard from './JobCard'
import { format } from 'date-fns'

const JobList = () => {
  const {
    jobs,
    isLoading,
    currentDate,
    fetchJobs,
  } = useJobStore()

  useEffect(() => {
    // Fetch jobs for the current month
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    fetchJobs(startDate, endDate)
  }, [currentDate, fetchJobs])

  // Get upcoming jobs (next 7 days)
  const upcomingJobs = useMemo(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return jobs
      .filter((job) => {
        const jobDate = new Date(job.startTime)
        return jobDate >= today && jobDate <= nextWeek && job.status !== 'cancelled'
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

  if (upcomingJobs.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-primary-light/70">No upcoming jobs scheduled</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {upcomingJobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}

export default JobList

