import { useEffect, useMemo, useState } from 'react'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogCard from './JobLogCard'
import { Input, Button, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface JobLogListProps {
  onCreateClick?: () => void
  onSelectJobLog: (id: string) => void
  showCreatedBy?: boolean
}

type DisplayMode = 'cards' | 'list'
type SortBy = 'recent' | 'oldest' | 'title'

const JobLogList = ({ onCreateClick, onSelectJobLog, showCreatedBy }: JobLogListProps) => {
  const {
    jobLogs,
    isLoading,
    error,
    fetchJobLogs,
    clearError,
    deleteJobLog,
  } = useJobLogStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'inactive'>('all')
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('joblogs-display-mode')
    return (saved as DisplayMode) || 'cards'
  })
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const saved = localStorage.getItem('joblogs-sort-by')
    return (saved as SortBy) || 'recent'
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const toggleSelection = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredJobLogs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredJobLogs.map((j) => j.id)))
    }
  }

  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true)
      const idsToDelete = Array.from(selectedIds)
      const errors: string[] = []

      const BATCH_SIZE = 5
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map((id) => deleteJobLog(id))
        )

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            errors.push(batch[index])
          }
        })
      }

      await fetchJobLogs()

      if (errors.length > 0) {
        setSelectedIds(new Set(errors))
        alert(
          `${idsToDelete.length - errors.length} job(s) deleted successfully. ${errors.length} job(s) failed - they remain selected for retry.`
        )
      } else {
        setSelectedIds(new Set())
      }
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Bulk delete failed:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredJobLogs = useMemo(() => {
    let filtered = jobLogs

    if (statusFilter !== 'all') {
      filtered = filtered.filter((j) => {
        const s = j.status ?? 'active'
        if (statusFilter === 'inactive') return s === 'inactive' || s === 'archived'
        return s === statusFilter
      })
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
                e.target.value as 'all' | 'active' | 'completed' | 'inactive'
              )
            }
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'inactive', label: 'Inactive' },
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

      {/* Results Count and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-primary-light/70">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-gold">
              {selectedIds.size} selected
            </span>
          ) : (
            `${filteredJobLogs.length} job${filteredJobLogs.length !== 1 ? 's' : ''} found`
          )}
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-primary-dark border border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-400 mb-2">
                  Delete {selectedIds.size} Job{selectedIds.size !== 1 ? 's' : ''}?
                </h3>
                <p className="text-sm text-primary-light/70 mb-4">
                  This action cannot be undone. All selected jobs will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="rounded-lg border border-primary-blue overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary-dark-secondary border-b border-primary-blue">
                  <tr>
                    <th className="px-4 py-3 w-12" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden md:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden sm:table-cell">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden lg:table-cell">
                      Assigned to
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden lg:table-cell">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-blue">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx} className="bg-primary-dark animate-pulse">
                      <td className="px-4 py-3 w-12">
                        <div className="h-4 w-4 rounded-full bg-white/10 mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 bg-white/10 rounded w-32" />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="h-4 bg-white/10 rounded w-24" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="h-4 bg-white/10 rounded w-28" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="h-4 bg-white/10 rounded w-24" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="h-4 bg-white/10 rounded w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 bg-white/10 rounded w-16" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 bg-white/10 rounded w-16" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredJobLogs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70 mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'No jobs match your filters'
              : 'No jobs yet'}
          </p>
          {!searchQuery &&
            statusFilter === 'all' &&
            onCreateClick && (
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
              isSelected={selectedIds.has(jobLog.id)}
              onToggleSelect={toggleSelection}
              showCreatedBy={showCreatedBy}
            />
          ))}
        </div>
      ) : (
        // List Layout (table - matches Quotes page)
        <div className="rounded-lg border border-primary-blue overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary-dark-secondary border-b border-primary-blue">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <div
                      onClick={toggleSelectAll}
                      className={cn(
                        'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                        selectedIds.size === filteredJobLogs.length && filteredJobLogs.length > 0
                          ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                          : 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                      )}
                    >
                      {selectedIds.size === filteredJobLogs.length && filteredJobLogs.length > 0 && (
                        <div className="w-2 h-2 rounded-full bg-primary-dark" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden md:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden lg:table-cell">
                    Assigned to
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden lg:table-cell">
                    Location
                  </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-primary-blue">
                {filteredJobLogs.map((jobLog) => {
                  const hasTime = (jobLog.timeEntries?.length ?? 0) > 0
                  return (
                    <tr
                      key={jobLog.id}
                      className="bg-primary-dark hover:bg-primary-dark/50 transition-colors cursor-pointer"
                      onClick={() => onSelectJobLog(jobLog.id)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div
                          onClick={(e) => toggleSelection(jobLog.id, e)}
                          className={cn(
                            'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                            selectedIds.has(jobLog.id)
                              ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                              : 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                          )}
                        >
                          {selectedIds.has(jobLog.id) && (
                            <div className="w-2 h-2 rounded-full bg-primary-dark" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary-light">
                          {jobLog.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden md:table-cell">
                        {format(new Date(jobLog.updatedAt || jobLog.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden sm:table-cell">
                        <div className="truncate max-w-[150px]">{jobLog.contact?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden lg:table-cell">
                        <div className="truncate max-w-[150px]">{jobLog.assignedToName || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden lg:table-cell">
                        <div className="truncate max-w-[150px]">{jobLog.location || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const s = jobLog.status === 'archived' ? 'inactive' : (jobLog.status || 'active')
                          const classes = { active: 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20', completed: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20', inactive: 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20' }
                          return (
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', classes[s as keyof typeof classes] || classes.inactive)}>
                              {s}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary-gold">
                          {hasTime ? computeTotalHours(jobLog) : '—'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobLogList
