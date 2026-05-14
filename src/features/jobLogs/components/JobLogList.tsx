import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogCard from './JobLogCard'
import { Input, Button, Select, Checkbox, ConfirmationDialog } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { getRecurringTag } from '../utils/recurringPattern'
import { useTheme } from '@/contexts/ThemeContext'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import {
  archiveWorkspaceJobSingle,
  fetchWorkspaceJobSchedulingMeta,
  permanentDeleteWorkspaceBookingOrJob,
} from '../utils/workspaceJobDelete'

interface JobLogListProps {
  onCreateClick?: () => void
  onSelectJobLog: (id: string) => void
}

type DisplayMode = 'cards' | 'list'
type SortBy = 'recent' | 'oldest' | 'title'

const JobLogList = ({ onCreateClick, onSelectJobLog }: JobLogListProps) => {
  const { theme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const { jobLogs, isLoading, error, fetchJobLogs, clearError } = useJobLogStore()
  const { fetchJobs } = useJobStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'inactive'>(
    'all'
  )
  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    const saved = localStorage.getItem('joblogs-show-completed')
    return saved !== null ? saved === 'true' : true // Default to showing completed
  })
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('joblogs-display-mode')
    return (saved as DisplayMode) || 'cards'
  })
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const saved = localStorage.getItem('joblogs-sort-by')
    return (saved as SortBy) || 'recent'
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkArchiveConfirm, setShowBulkArchiveConfirm] = useState(false)
  const [showBulkPermanentConfirm, setShowBulkPermanentConfirm] = useState(false)

  const showCompletedPriorToCompletedFilterRef = useRef<boolean | null>(null)
  const prevStatusFilterRef = useRef(statusFilter)

  useEffect(() => {
    fetchJobLogs()
  }, [fetchJobLogs])

  useEffect(() => {
    setStatusFilter('all')
  }, [])

  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return
    if (status !== 'active' && status !== 'completed' && status !== 'inactive') return
    setStatusFilter(status)
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, setStatusFilter])

  useEffect(() => {
    const prev = prevStatusFilterRef.current
    if (statusFilter === 'completed' && prev !== 'completed') {
      showCompletedPriorToCompletedFilterRef.current = showCompleted
      setShowCompleted(true)
    } else if (statusFilter !== 'completed' && prev === 'completed') {
      const prior = showCompletedPriorToCompletedFilterRef.current
      if (prior !== null) {
        setShowCompleted(prior)
      }
    }
    prevStatusFilterRef.current = statusFilter
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read showCompleted only when statusFilter changes
  }, [statusFilter])

  useEffect(() => {
    localStorage.setItem('joblogs-display-mode', displayMode)
  }, [displayMode])

  useEffect(() => {
    localStorage.setItem('joblogs-sort-by', sortBy)
  }, [sortBy])

  useEffect(() => {
    if (statusFilter === 'completed') return
    localStorage.setItem('joblogs-show-completed', String(showCompleted))
  }, [showCompleted, statusFilter])

  const showCompletedEffective = statusFilter === 'completed' ? true : showCompleted

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
      setSelectedIds(new Set(filteredJobLogs.map(j => j.id)))
    }
  }

  const syncCalendarJobs = async () => {
    try {
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 2)
      startDate.setDate(1)
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + 5)
      endDate.setDate(0)
      await fetchJobs(startDate, endDate)
    } catch {
      await fetchJobs()
    }
  }

  const runBulkWorkspaceAction = async (mode: 'archive' | 'permanent') => {
    const idsToProcess = Array.from(selectedIds)
    const skippedTitles: string[] = []
    const errors: string[] = []

    for (const id of idsToProcess) {
      const jl = jobLogs.find(j => j.id === id)
      if (!jl) continue
      try {
        const meta = await fetchWorkspaceJobSchedulingMeta(jl)
        if (meta.recurrenceId && (meta.occurrenceCount ?? 0) > 1) {
          skippedTitles.push(jl.title || id)
          continue
        }
        if (mode === 'archive') {
          await archiveWorkspaceJobSingle(meta)
        } else {
          await permanentDeleteWorkspaceBookingOrJob(meta)
        }
      } catch {
        errors.push(id)
      }
    }

    await fetchJobLogs()
    await syncCalendarJobs()

    if (errors.length > 0) {
      setSelectedIds(new Set(errors))
      alert(
        `${idsToProcess.length - errors.length - skippedTitles.length} job(s) updated. ${errors.length} failed (still selected).`
      )
    } else {
      setSelectedIds(new Set())
    }

    if (skippedTitles.length > 0) {
      alert(
        `${skippedTitles.length} recurring job(s) were skipped. Open each job to archive or delete the series: ${skippedTitles.join(', ')}`
      )
    }

    setShowBulkArchiveConfirm(false)
    setShowBulkPermanentConfirm(false)
  }

  const filteredJobLogs = useMemo(() => {
    let filtered = jobLogs

    // Filter out completed jobs if toggle is off (always show them when Completed status filter is on)
    if (!showCompletedEffective) {
      filtered = filtered.filter(j => {
        const s = j.status ?? 'active'
        return s !== 'completed'
      })
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(j => {
        const s = j.status ?? 'active'
        if (statusFilter === 'inactive') return s === 'inactive' || s === 'archived'
        return s === statusFilter
      })
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        j =>
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
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return sorted
  }, [jobLogs, statusFilter, searchQuery, sortBy, showCompletedEffective])

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
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
          <label
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap flex-shrink-0',
              statusFilter === 'completed' ? 'cursor-not-allowed opacity-90' : 'cursor-pointer',
              theme === 'dark'
                ? 'border-primary-blue/30 bg-primary-dark-secondary'
                : 'border-gray-200 bg-white'
            )}
            title={
              statusFilter === 'completed'
                ? 'Show completed is required while filtering by Completed status'
                : undefined
            }
          >
            <Checkbox
              checked={showCompletedEffective}
              disabled={statusFilter === 'completed'}
              onChange={e => setShowCompleted(e.target.checked)}
            />
            <span
              className={cn(
                'text-sm select-none',
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}
            >
              Show completed
            </span>
          </label>
          <Select
            value={statusFilter}
            onChange={e =>
              setStatusFilter(e.target.value as 'all' | 'active' | 'completed' | 'inactive')
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
            onChange={e => setSortBy(e.target.value as SortBy)}
            options={[
              { value: 'recent', label: 'Sort: Recent' },
              { value: 'oldest', label: 'Sort: Oldest' },
              { value: 'title', label: 'Sort: Title' },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
          <div
            className={cn(
              'flex gap-1 border rounded-lg p-1',
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}
          >
            <button
              onClick={() => setDisplayMode('cards')}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                displayMode === 'cards'
                  ? 'bg-primary-gold text-primary-dark'
                  : theme === 'dark'
                    ? 'text-primary-light hover:bg-primary-blue/20'
                    : 'text-primary-lightText hover:bg-gray-100'
              )}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                displayMode === 'list'
                  ? 'bg-primary-gold text-primary-dark'
                  : theme === 'dark'
                    ? 'text-primary-light hover:bg-primary-blue/20'
                    : 'text-primary-lightText hover:bg-gray-100'
              )}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className={
                theme === 'dark'
                  ? 'text-primary-light/70 hover:text-primary-light'
                  : 'text-primary-lightTextSecondary hover:text-primary-lightText'
              }
              title="Clear search and filters"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results Count and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'text-sm',
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}
        >
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-gold">{selectedIds.size} selected</span>
          ) : (
            `${filteredJobLogs.length} job${filteredJobLogs.length !== 1 ? 's' : ''} found`
          )}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkArchiveConfirm(true)}
              className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              Archive ({selectedIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkPermanentConfirm(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Delete permanently ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showBulkArchiveConfirm}
        onClose={() => setShowBulkArchiveConfirm(false)}
        onConfirm={() => runBulkWorkspaceAction('archive')}
        title={`Archive ${selectedIds.size} job${selectedIds.size !== 1 ? 's' : ''}?`}
        message={
          <div className="space-y-3">
            <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
              Archived jobs can be restored later from the Archive tab (Jobs or Calendar), matching
              the calendar flow.
            </p>
            <p
              className={cn(
                'text-sm',
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}
            >
              Jobs that are part of a recurring series are skipped here—open each one to choose one
              occurrence or the whole series.
            </p>
          </div>
        }
        confirmText="Archive"
        confirmVariant="danger"
      />

      <ConfirmationDialog
        isOpen={showBulkPermanentConfirm}
        onClose={() => setShowBulkPermanentConfirm(false)}
        onConfirm={() => runBulkWorkspaceAction('permanent')}
        title={`Permanently remove ${selectedIds.size} job${selectedIds.size !== 1 ? 's' : ''}?`}
        message={
          <div className="space-y-3">
            <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
              This cannot be undone. For jobs with a scheduled booking, only the booking is
              permanently removed (same as the calendar). Jobs without a booking are removed
              entirely.
            </p>
            <p
              className={cn(
                'text-sm',
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}
            >
              Recurring series are skipped in bulk—open each job to delete permanently with full
              options.
            </p>
          </div>
        }
        confirmText="Delete permanently"
        confirmVariant="danger"
      />

      {/* Job Log List */}
      {isLoading ? (
        displayMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border p-4 shadow-sm animate-pulse',
                  theme === 'dark'
                    ? 'border-white/10 bg-primary-dark-secondary shadow-black/20'
                    : 'border-gray-200/20 bg-white'
                )}
              >
                <div
                  className={cn(
                    'h-4 rounded w-2/3',
                    theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                  )}
                />
                <div
                  className={cn(
                    'h-3 rounded w-1/2 mt-3',
                    theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                  )}
                />
                <div
                  className={cn(
                    'h-3 rounded w-1/3 mt-2',
                    theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                  )}
                />
                <div
                  className={cn(
                    'h-3 rounded w-full mt-4',
                    theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                  )}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-lg border overflow-hidden',
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead
                  className={cn(
                    'border-b',
                    theme === 'dark'
                      ? 'bg-primary-dark-secondary border-primary-blue'
                      : 'bg-gray-50 border-gray-200/20'
                  )}
                >
                  <tr>
                    <th className="px-4 py-3 w-12" />
                    <th
                      className={cn(
                        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Job
                    </th>
                    <th
                      className={cn(
                        'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Created
                    </th>
                    <th
                      className={cn(
                        'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Contact
                    </th>
                    <th
                      className={cn(
                        'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Assigned to
                    </th>
                    <th
                      className={cn(
                        'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Location
                    </th>
                    <th
                      className={cn(
                        'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Status
                    </th>
                    <th
                      className={cn(
                        'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell',
                        theme === 'dark'
                          ? 'text-primary-light/70'
                          : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-primary-blue' : 'divide-gray-200/20'
                  )}
                >
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const skeletonClass = theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                    return (
                      <tr
                        key={idx}
                        className={cn(
                          'animate-pulse',
                          theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                        )}
                      >
                        <td className="px-4 py-3 w-12">
                          <div className={cn('h-4 w-4 rounded-full mx-auto', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn('h-4 rounded w-32', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className={cn('h-4 rounded w-24', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className={cn('h-4 rounded w-28', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className={cn('h-4 rounded w-24', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className={cn('h-4 rounded w-20', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn('h-4 rounded w-16', skeletonClass)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn('h-4 rounded w-16', skeletonClass)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredJobLogs.length === 0 ? (
        <div className="text-center py-12">
          <p
            className={cn(
              'mb-4',
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}
          >
            {searchQuery || statusFilter !== 'all' ? 'No jobs match your filters' : 'No jobs yet'}
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
          {filteredJobLogs.map(jobLog => (
            <JobLogCard
              key={jobLog.id}
              jobLog={jobLog}
              onClick={() => onSelectJobLog(jobLog.id)}
              isSelected={selectedIds.has(jobLog.id)}
              onToggleSelect={toggleSelection}
            />
          ))}
        </div>
      ) : (
        // List Layout (table - matches Quotes page)
        <div
          className={cn(
            'rounded-lg border overflow-hidden',
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                className={cn(
                  'border-b',
                  theme === 'dark'
                    ? 'bg-primary-dark-secondary border-primary-blue'
                    : 'bg-gray-50 border-gray-200/20'
                )}
              >
                <tr>
                  <th className="px-2 sm:px-4 py-3 w-8 sm:w-12">
                    <div
                      onClick={toggleSelectAll}
                      className={cn(
                        'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                        selectedIds.size === filteredJobLogs.length && filteredJobLogs.length > 0
                          ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                          : theme === 'dark'
                            ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                            : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-gray-100'
                      )}
                    >
                      {selectedIds.size === filteredJobLogs.length &&
                        filteredJobLogs.length > 0 && (
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                            )}
                          />
                        )}
                    </div>
                  </th>
                  <th
                    className={cn(
                      'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Job
                  </th>
                  <th
                    className={cn(
                      'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Created
                  </th>
                  <th
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Contact
                  </th>
                  <th
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Assigned to
                  </th>
                  <th
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Location
                  </th>
                  <th
                    className={cn(
                      'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Status
                  </th>
                  <th
                    className={cn(
                      'px-2 sm:px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell',
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  'divide-y',
                  theme === 'dark' ? 'divide-primary-blue' : 'divide-gray-200/20'
                )}
              >
                {filteredJobLogs.map(jobLog => {
                  const hasTime = (jobLog.timeEntries?.length ?? 0) > 0
                  const recurringTag = jobLog.bookings ? getRecurringTag(jobLog.bookings) : null
                  return (
                    <tr
                      key={jobLog.id}
                      className={cn(
                        'transition-colors cursor-pointer',
                        theme === 'dark'
                          ? 'bg-primary-dark hover:bg-primary-dark/50'
                          : 'bg-white hover:bg-gray-50'
                      )}
                      onClick={() => onSelectJobLog(jobLog.id)}
                    >
                      <td className="px-2 sm:px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div
                          onClick={e => toggleSelection(jobLog.id, e)}
                          className={cn(
                            'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                            selectedIds.has(jobLog.id)
                              ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                              : theme === 'dark'
                                ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                                : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-gray-100'
                          )}
                        >
                          {selectedIds.has(jobLog.id) && (
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                              )}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'text-sm font-medium truncate min-w-0',
                              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                            )}
                          >
                            {jobLog.title}
                          </span>
                          {recurringTag && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary-blue/20 text-primary-gold border border-primary-blue/30 rounded shrink-0">
                              {recurringTag}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-2 sm:px-4 py-3 text-sm',
                          theme === 'dark'
                            ? 'text-primary-light/70'
                            : 'text-primary-lightTextSecondary'
                        )}
                      >
                        <span className="hidden sm:inline whitespace-nowrap">
                          {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
                        </span>
                        <span className="sm:hidden whitespace-nowrap">
                          {format(new Date(jobLog.createdAt), 'MMM d')}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-2 sm:px-4 py-3 whitespace-nowrap text-sm hidden sm:table-cell',
                          theme === 'dark'
                            ? 'text-primary-light/70'
                            : 'text-primary-lightTextSecondary'
                        )}
                      >
                        <div className="truncate max-w-[150px]">{jobLog.contact?.name || '-'}</div>
                      </td>
                      <td
                        className={cn(
                          'px-2 sm:px-4 py-3 whitespace-nowrap text-sm hidden lg:table-cell',
                          theme === 'dark'
                            ? 'text-primary-light/70'
                            : 'text-primary-lightTextSecondary'
                        )}
                      >
                        <div className="truncate max-w-[150px]">{jobLog.assignedToName || '-'}</div>
                      </td>
                      <td
                        className={cn(
                          'px-2 sm:px-4 py-3 whitespace-nowrap text-sm hidden lg:table-cell',
                          theme === 'dark'
                            ? 'text-primary-light/70'
                            : 'text-primary-lightTextSecondary'
                        )}
                      >
                        <div className="truncate max-w-[150px]">{jobLog.location || '-'}</div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                        {(() => {
                          const s =
                            jobLog.status === 'archived' ? 'inactive' : jobLog.status || 'active'
                          const classes = {
                            active:
                              theme === 'dark'
                                ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                                : 'bg-green-100 text-green-700 ring-1 ring-green-300',
                            completed:
                              theme === 'dark'
                                ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                                : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
                            inactive:
                              theme === 'dark'
                                ? 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20'
                                : 'bg-gray-200 text-gray-600 ring-1 ring-gray-300',
                          }
                          return (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap',
                                classes[s as keyof typeof classes] || classes.inactive
                              )}
                            >
                              {s}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap hidden sm:table-cell">
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
