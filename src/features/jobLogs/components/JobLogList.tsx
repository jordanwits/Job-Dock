import { useEffect, useMemo, useState } from 'react'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogCard from './JobLogCard'
import { Input, Button, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface JobLogListProps {
  onCreateClick?: () => void
  onSelectJobLog: (id: string) => void
}

type DisplayMode = 'cards' | 'list'
type SortBy = 'recent' | 'oldest' | 'title'

const JobLogList = ({ onCreateClick, onSelectJobLog }: JobLogListProps) => {
  const {
    jobLogs,
    isLoading,
    error,
    fetchJobLogs,
    clearError,
  } = useJobLogStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all')
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('joblogs-display-mode')
    return (saved as DisplayMode) || 'cards'
  })
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const saved = localStorage.getItem('joblogs-sort-by')
    return (saved as SortBy) || 'recent'
  })

  useEffect(() => {
    fetchJobLogs()
  }, [fetchJobLogs])

  useEffect(() => {
    localStorage.setItem('joblogs-display-mode', displayMode)
  }, [displayMode])

  useEffect(() => {
    localStorage.setItem('joblogs-sort-by', sortBy)
  }, [sortBy])

  const hasFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all'
  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  const filteredJobLogs = useMemo(() => {
    let filtered = jobLogs

    if (statusFilter !== 'all') {
      filtered = filtered.filter((j) => j.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q) ||
          j.contact?.name?.toLowerCase().includes(q)
      )
    }

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      // recent
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    })

    return sorted
  }, [jobLogs, statusFilter, searchQuery, sortBy])

  const computeTotalHours = (jobLog: (typeof jobLogs)[0]) => {
    const totalMinutes =
      jobLog.timeEntries?.reduce((sum, te) => {
        const start = new Date(te.startTime).getTime()
        const end = new Date(te.endTime).getTime()
        const breakMin = te.breakMinutes ?? 0
        return sum + (end - start) / 60000 - breakMin
      }, 0) ?? 0
    const h = Math.floor(totalMinutes / 60)
    const m = Math.round(totalMinutes % 60)
    return `${h}h ${m}m`
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
        <p className="text-sm text-red-500">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearError()
            fetchJobLogs()
          }}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    )
  }

  const statusColors = {
    active: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  const statusLabels = {
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  } as const

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'active' | 'completed' | 'archived'
              )
            }
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            options={[
              { value: 'recent', label: 'Sort: Recent' },
              { value: 'oldest', label: 'Sort: Oldest' },
              { value: 'title', label: 'Sort: Title' },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
          <div className="flex gap-1 border border-primary-blue rounded-lg p-1">
            <button
              onClick={() => setDisplayMode('cards')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                displayMode === 'cards'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'text-primary-light hover:bg-primary-blue/20'
              }`}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                displayMode === 'list'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'text-primary-light hover:bg-primary-blue/20'
              }`}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-primary-light/70 hover:text-primary-light"
              title="Clear search and filters"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-primary-light/70">
          {`${filteredJobLogs.length} job${filteredJobLogs.length !== 1 ? 's' : ''} found`}
        </div>
        {!isLoading && filteredJobLogs.length > 0 && onCreateClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateClick}
            className="hidden sm:inline-flex"
          >
            New Job
          </Button>
        )}
      </div>

      {/* Job Log List */}
      {isLoading ? (
        displayMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-primary-dark-secondary p-4 shadow-sm shadow-black/20 animate-pulse"
              >
                <div className="h-4 bg-white/10 rounded w-2/3" />
                <div className="h-3 bg-white/10 rounded w-1/2 mt-3" />
                <div className="h-3 bg-white/10 rounded w-1/3 mt-2" />
                <div className="h-3 bg-white/10 rounded w-full mt-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-primary-blue bg-primary-dark p-4 animate-pulse"
              >
                <div className="h-4 bg-white/10 rounded w-1/2" />
                <div className="h-3 bg-white/10 rounded w-1/3 mt-3" />
              </div>
            ))}
          </div>
        )
      ) : filteredJobLogs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70 mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'No jobs match your filters'
              : 'No jobs yet'}
          </p>
          {!searchQuery && statusFilter === 'all' && onCreateClick && (
            <Button variant="primary" onClick={onCreateClick}>
              Create Your First Job
            </Button>
          )}
        </div>
      ) : displayMode === 'cards' ? (
        // Card Grid Layout
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobLogs.map((jobLog) => (
            <JobLogCard
              key={jobLog.id}
              jobLog={jobLog}
              onClick={() => onSelectJobLog(jobLog.id)}
            />
          ))}
        </div>
      ) : (
        // List Layout (compact rows - better than a table on desktop)
        <div className="space-y-3">
          {filteredJobLogs.map((jobLog) => {
            const photoCount = jobLog.photos?.length ?? 0
            const hasTime = (jobLog.timeEntries?.length ?? 0) > 0
            const meta = [jobLog.location, jobLog.contact?.name].filter(Boolean).join(' • ')

            return (
              <div
                key={jobLog.id}
                onClick={() => onSelectJobLog(jobLog.id)}
                className="rounded-lg border border-primary-blue bg-primary-dark p-4 cursor-pointer hover:bg-primary-dark/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary-light truncate">
                      {jobLog.title}
                    </div>
                    <div className="text-xs text-primary-light/50 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{format(new Date(jobLog.updatedAt || jobLog.createdAt), 'MMM d, yyyy')}</span>
                      {meta && <span className="text-primary-light/40">•</span>}
                      {meta && <span className="truncate max-w-[340px] text-primary-light/60">{meta}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span
                      className={cn(
                        'px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border whitespace-nowrap',
                        statusColors[jobLog.status as keyof typeof statusColors] ||
                          'border-primary-blue/30 text-primary-light/70'
                      )}
                    >
                      {statusLabels[jobLog.status as keyof typeof statusLabels] ?? jobLog.status}
                    </span>
                    <span className={cn('text-xs', hasTime ? 'text-primary-gold' : 'text-primary-light/50')}>
                      {hasTime ? computeTotalHours(jobLog) : '—'}
                    </span>
                    {photoCount > 0 && (
                      <span className="text-xs text-primary-light/60 whitespace-nowrap">
                        {photoCount} photo{photoCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default JobLogList
