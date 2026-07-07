import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogCard from './JobLogCard'
import { cn, formatHoursMinutes } from '@/lib/utils'
import { format } from 'date-fns'
import { getRecurringTag } from '../utils/recurringPattern'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import {
  archiveWorkspaceJobSingle,
  fetchWorkspaceJobSchedulingMeta,
  permanentDeleteWorkspaceBookingOrJob,
} from '../utils/workspaceJobDelete'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CardsIcon,
  CheckboxField,
  DocumentIcon,
  EmptyState,
  ListIcon,
  SearchIcon,
  SelectCircle,
  SelectField,
  StatusBadge,
  TagChip,
  TextField,
} from './jobLogsUi'
import { JOB_STATUS, JOB_STATUS_FILTER_OPTIONS, type JobLogStatus } from './jobLogStatus'

interface JobLogListProps {
  onCreateClick?: () => void
  onSelectJobLog: (id: string) => void
}

type DisplayMode = 'cards' | 'list'
type SortBy = 'recent' | 'oldest' | 'title'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Sort: Recent' },
  { value: 'oldest', label: 'Sort: Oldest' },
  { value: 'title', label: 'Sort: Title' },
]

const resolveStatus = (status?: string): JobLogStatus => {
  if (status === 'archived') return 'inactive'
  if (status === 'completed' || status === 'inactive') return status
  return 'active'
}

const JobLogList = ({ onCreateClick, onSelectJobLog }: JobLogListProps) => {
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

  // Clear bulk selection when the visible set changes, so bulk archive/delete
  // can never act on jobs hidden by the current filter/search.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [statusFilter, searchQuery, showCompleted])

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
    const { hours: h, minutes: m } = formatHoursMinutes(totalMinutes / 60)
    return `${h}h ${m}m`
  }

  if (error) {
    return (
      <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
        <p>{error}</p>
        <button
          onClick={() => {
            clearError()
            fetchJobLogs()
          }}
          className="mt-1.5 font-semibold underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <TextField
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            aria-label="Search jobs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div
            className={cn(
              'flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg border border-line bg-surface px-3',
              statusFilter === 'completed' && 'opacity-90'
            )}
            title={
              statusFilter === 'completed'
                ? 'Show completed is required while filtering by Completed status'
                : undefined
            }
          >
            <CheckboxField
              id="joblogs-show-completed"
              checked={showCompletedEffective}
              onChange={checked => {
                if (statusFilter !== 'completed') setShowCompleted(checked)
              }}
              label={<span className="select-none whitespace-nowrap">Show completed</span>}
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <SelectField
              value={statusFilter}
              onChange={e =>
                setStatusFilter(e.target.value as 'all' | 'active' | 'completed' | 'inactive')
              }
              aria-label="Filter by status"
              options={JOB_STATUS_FILTER_OPTIONS}
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <SelectField
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              aria-label="Sort jobs"
              options={SORT_OPTIONS}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
            <button
              onClick={() => setDisplayMode('cards')}
              className={cn(
                'flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                displayMode === 'cards' ? 'bg-surface text-accent-strong shadow-card' : 'text-ink-subtle hover:text-ink'
              )}
              title="Card view"
              aria-label="Card view"
              aria-pressed={displayMode === 'cards'}
            >
              <CardsIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={cn(
                'flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                displayMode === 'list' ? 'bg-surface text-accent-strong shadow-card' : 'text-ink-subtle hover:text-ink'
              )}
              title="List view"
              aria-label="List view"
              aria-pressed={displayMode === 'list'}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>

          {hasFilters && (
            <AppButton variant="ghost" size="sm" onClick={clearFilters} title="Clear search and filters">
              Clear
            </AppButton>
          )}
        </div>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex min-h-[2.25rem] items-center justify-between">
        <div className="text-sm text-ink-muted">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-accent-strong">
              <span className="font-mono tabular-nums">{selectedIds.size}</span> selected
            </span>
          ) : (
            <>
              <span className="font-mono tabular-nums text-ink">{filteredJobLogs.length}</span>{' '}
              {filteredJobLogs.length === 1 ? 'job' : 'jobs'} found
            </>
          )}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <AppButton variant="subtle" size="sm" onClick={() => setShowBulkArchiveConfirm(true)}>
              Archive ({selectedIds.size})
            </AppButton>
            <AppButton variant="dangerGhost" size="sm" onClick={() => setShowBulkPermanentConfirm(true)}>
              Delete permanently ({selectedIds.size})
            </AppButton>
          </div>
        )}
      </div>

      {/* Bulk archive confirmation */}
      <AppModal
        isOpen={showBulkArchiveConfirm}
        onClose={() => setShowBulkArchiveConfirm(false)}
        title={`Archive ${selectedIds.size} job${selectedIds.size !== 1 ? 's' : ''}?`}
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowBulkArchiveConfirm(false)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={() => runBulkWorkspaceAction('archive')}>
              Archive
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ink">
            Archived jobs can be restored later from the Archive tab (Jobs or Calendar), matching the
            calendar flow.
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">
            Jobs that are part of a recurring series are skipped here—open each one to choose one
            occurrence or the whole series.
          </p>
        </div>
      </AppModal>

      {/* Bulk permanent delete confirmation */}
      <AppModal
        isOpen={showBulkPermanentConfirm}
        onClose={() => setShowBulkPermanentConfirm(false)}
        title={`Permanently remove ${selectedIds.size} job${selectedIds.size !== 1 ? 's' : ''}?`}
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowBulkPermanentConfirm(false)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={() => runBulkWorkspaceAction('permanent')}>
              Delete permanently
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ink">
            This cannot be undone. For jobs with a scheduled booking, only the booking is permanently
            removed (same as the calendar). Jobs without a booking are removed entirely.
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">
            Recurring series are skipped in bulk—open each job to delete permanently with full
            options.
          </p>
        </div>
      </AppModal>

      {/* Job log list */}
      {isLoading ? (
        displayMode === 'cards' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-xl bg-surface p-5 shadow-card">
                <div className="h-4 w-2/3 rounded bg-surface-2" />
                <div className="mt-3 h-3 w-1/2 rounded bg-surface-2" />
                <div className="mt-2 h-3 w-1/3 rounded bg-surface-2" />
                <div className="mt-4 h-3 w-full rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-surface shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <th className="w-12 px-4 py-3" />
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                      Job
                    </th>
                    <th className="hidden px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:px-4 md:table-cell">
                      Created
                    </th>
                    <th className="hidden px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:table-cell sm:px-4">
                      Contact
                    </th>
                    <th className="hidden px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:px-4 lg:table-cell">
                      Assigned to
                    </th>
                    <th className="hidden px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:px-4 lg:table-cell">
                      Location
                    </th>
                    <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:px-4">
                      Status
                    </th>
                    <th className="hidden px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:table-cell sm:px-4">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse bg-surface">
                      <td className="w-12 px-4 py-3">
                        <div className="mx-auto h-4 w-4 rounded-full bg-surface-2" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-32 rounded bg-surface-2" />
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="h-4 w-24 rounded bg-surface-2" />
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="h-4 w-28 rounded bg-surface-2" />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <div className="h-4 w-24 rounded bg-surface-2" />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <div className="h-4 w-20 rounded bg-surface-2" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-16 rounded bg-surface-2" />
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="h-4 w-16 rounded bg-surface-2" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredJobLogs.length === 0 ? (
        <EmptyState
          icon={<DocumentIcon className="h-7 w-7" />}
          title={
            searchQuery || statusFilter !== 'all' ? 'No jobs match your filters.' : 'No jobs yet.'
          }
          action={
            !searchQuery && statusFilter === 'all' && onCreateClick ? (
              <AppButton onClick={onCreateClick} className="mt-1">
                Create your first job
              </AppButton>
            ) : undefined
          }
        />
      ) : displayMode === 'cards' ? (
        // Card grid layout
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        // List layout (table)
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line">
                <tr>
                  <th className="w-8 px-2 py-3 sm:w-12 sm:px-4">
                    <SelectCircle
                      selected={
                        selectedIds.size === filteredJobLogs.length && filteredJobLogs.length > 0
                      }
                      onClick={e => {
                        e.stopPropagation()
                        toggleSelectAll()
                      }}
                      label="Select all"
                      className="mx-auto"
                    />
                  </th>
                  <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:px-4">
                    Job
                  </th>
                  <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:px-4">
                    Created
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:table-cell">
                    Contact
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle lg:table-cell">
                    Assigned to
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle lg:table-cell">
                    Location
                  </th>
                  <th className="hidden px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:table-cell sm:px-4">
                    Status
                  </th>
                  <th className="hidden px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:table-cell sm:px-4">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredJobLogs.map(jobLog => {
                  const hasTime = (jobLog.timeEntries?.length ?? 0) > 0
                  const recurringTag = jobLog.bookings ? getRecurringTag(jobLog.bookings) : null
                  const status = JOB_STATUS[resolveStatus(jobLog.status)]
                  return (
                    <tr
                      key={jobLog.id}
                      className="cursor-pointer bg-surface transition-colors hover:bg-surface-hover"
                      onClick={() => onSelectJobLog(jobLog.id)}
                    >
                      <td className="px-2 py-3 sm:px-4" onClick={e => e.stopPropagation()}>
                        <SelectCircle
                          selected={selectedIds.has(jobLog.id)}
                          onClick={e => toggleSelection(jobLog.id, e)}
                          className="mx-auto"
                        />
                      </td>
                      <td className="min-w-0 px-2 py-3 sm:px-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 truncate text-sm font-medium text-ink">
                            {jobLog.title}
                          </span>
                          {recurringTag && <TagChip>{recurringTag}</TagChip>}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-sm text-ink-muted sm:px-4">
                        <span className="hidden whitespace-nowrap font-mono tabular-nums sm:inline">
                          {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
                        </span>
                        <span className="whitespace-nowrap font-mono tabular-nums sm:hidden">
                          {format(new Date(jobLog.createdAt), 'MMM d')}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-ink-muted sm:table-cell sm:px-4">
                        <div className="max-w-[150px] truncate">
                          {jobLog.contact?.name || <span className="text-ink-subtle">—</span>}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-ink-muted sm:px-4 lg:table-cell">
                        <div className="max-w-[150px] truncate">
                          {jobLog.assignedToName || <span className="text-ink-subtle">—</span>}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-ink-muted sm:px-4 lg:table-cell">
                        <div className="max-w-[150px] truncate">
                          {jobLog.location || <span className="text-ink-subtle">—</span>}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 sm:table-cell sm:px-4">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-right sm:table-cell sm:px-4">
                        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                          {hasTime ? computeTotalHours(jobLog) : '—'}
                        </span>
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
