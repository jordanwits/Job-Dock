import { useEffect, useMemo, useState } from 'react'
import { useJobStore } from '../store/jobStore'
import JobCard from './JobCard'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'

const JobList = () => {
  const {
    jobs,
    isLoading,
    currentDate,
    jobView,
    setJobView,
    fetchJobs,
  } = useJobStore()
  
  const [localView, setLocalView] = useState<'active' | 'archived' | 'trash'>('active')

  // Fetch jobs when view changes
  useEffect(() => {
    const startDate = startOfMonth(currentDate)
    const endDate = endOfMonth(addMonths(currentDate, 1))
    
    if (localView === 'archived') {
      fetchJobs(startDate, endDate, true, false) // includeArchived
    } else if (localView === 'trash') {
      fetchJobs(startDate, endDate, false, true) // showDeleted
    } else {
      fetchJobs(startDate, endDate, false, false) // active only
    }
  }, [localView, currentDate, fetchJobs])

  // Get filtered jobs based on view
  const filteredJobs = useMemo(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return jobs
      .filter((job) => {
        const jobDate = new Date(job.startTime)
        
        if (localView === 'trash') {
          return !!job.deletedAt
        } else if (localView === 'archived') {
          return !!job.archivedAt && !job.deletedAt
        } else {
          // Active view - upcoming jobs only
          return jobDate >= today && jobDate <= nextWeek && job.status !== 'cancelled' && !job.deletedAt && !job.archivedAt
        }
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [jobs, localView])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-primary-light/70">Loading jobs...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* View Tabs */}
      <div className="flex border-b border-primary-light/20 mb-4">
        <button
          onClick={() => setLocalView('active')}
          className={`
            px-4 py-2 font-medium transition-colors text-sm
            ${localView === 'active'
              ? 'text-primary-gold border-b-2 border-primary-gold'
              : 'text-primary-light/70 hover:text-primary-light'
            }
          `}
        >
          📋 Active
        </button>
        <button
          onClick={() => setLocalView('archived')}
          className={`
            px-4 py-2 font-medium transition-colors text-sm
            ${localView === 'archived'
              ? 'text-primary-gold border-b-2 border-primary-gold'
              : 'text-primary-light/70 hover:text-primary-light'
            }
          `}
        >
          📦 Archived
        </button>
        <button
          onClick={() => setLocalView('trash')}
          className={`
            px-4 py-2 font-medium transition-colors text-sm
            ${localView === 'trash'
              ? 'text-primary-gold border-b-2 border-primary-gold'
              : 'text-primary-light/70 hover:text-primary-light'
            }
          `}
        >
          🗑️ Trash
        </button>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-primary-light/70">
              {localView === 'trash' && 'No jobs in trash'}
              {localView === 'archived' && 'No archived jobs'}
              {localView === 'active' && 'No upcoming jobs scheduled'}
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

