import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogDetail from '../components/JobLogDetail'
import { ConfirmationDialog, Card, Button } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import DeleteRecurringJobModal from '@/features/scheduling/components/DeleteRecurringJobModal'
import PermanentDeleteRecurringJobModal from '@/features/scheduling/components/PermanentDeleteRecurringJobModal'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import type { Job } from '@/features/scheduling/types/job'
import {
  archiveWorkspaceJobRecurringAll,
  archiveWorkspaceJobSingle,
  fetchWorkspaceJobSchedulingMeta,
  permanentDeleteWorkspaceBookingOrJob,
} from '../utils/workspaceJobDelete'

const JobLogDetailPage = () => {
  const { theme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { fetchJobs } = useJobStore()
  const {
    selectedJobLog,
    isLoading,
    error: jobLogSaveError,
    getJobLogById,
    updateJobLog,
    setSelectedJobLog,
    clearError: clearJobLogError,
  } = useJobLogStore()

  const [editingJobLogId, setEditingJobLogId] = useState<string | null>(null)
  const [schedulingMeta, setSchedulingMeta] = useState<Job | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showPermanentConfirm, setShowPermanentConfirm] = useState(false)
  const [showDeleteRecurringModal, setShowDeleteRecurringModal] = useState(false)
  const [showPermanentDeleteRecurringModal, setShowPermanentDeleteRecurringModal] = useState(false)
  const [pinSaving, setPinSaving] = useState(false)
  const [sentBanner, setSentBanner] = useState<{ type: 'success' | 'failed'; message: string } | null>(
    null
  )

  const loadSchedulingMeta = async () => {
    if (!selectedJobLog) return null
    setMetaLoading(true)
    try {
      const meta = await fetchWorkspaceJobSchedulingMeta(selectedJobLog)
      setSchedulingMeta(meta)
      return meta
    } catch {
      return null
    } finally {
      setMetaLoading(false)
    }
  }

  const refreshAfterMutation = async () => {
    if (id) {
      await getJobLogById(id)
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
  }

  useEffect(() => {
    const quoteSent = searchParams.get('quoteSent')
    const invoiceSent = searchParams.get('invoiceSent')
    const quoteFailed = searchParams.get('quoteFailed')
    const invoiceFailed = searchParams.get('invoiceFailed')
    if (quoteSent === '1') {
      setSentBanner({ type: 'success', message: 'Quote sent successfully' })
      const next = new URLSearchParams(searchParams)
      next.delete('quoteSent')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    } else if (invoiceSent === '1') {
      setSentBanner({ type: 'success', message: 'Invoice sent successfully' })
      const next = new URLSearchParams(searchParams)
      next.delete('invoiceSent')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    } else if (quoteFailed === '1') {
      setSentBanner({ type: 'failed', message: 'Failed to send quote' })
      const next = new URLSearchParams(searchParams)
      next.delete('quoteFailed')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    } else if (invoiceFailed === '1') {
      setSentBanner({ type: 'failed', message: 'Failed to send invoice' })
      const next = new URLSearchParams(searchParams)
      next.delete('invoiceFailed')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (id) {
      setSelectedJobLog(null)
      getJobLogById(id)
    }
    return () => setSelectedJobLog(null)
  }, [id, getJobLogById, setSelectedJobLog])

  const handleBack = () => {
    navigate('/app/job-logs')
  }

  const handleSaveEdit = async (data: {
    title: string
    description?: string
    location?: string
    notes?: string
    jobId?: string
    contactId?: string
    price?: number | null
    serviceId?: string
    assignedTo?: import('../types/jobLog').JobAssignment[]
    status?: string
    payChangeEffectiveDate?: string
  }) => {
    if (!editingJobLogId) return
    try {
      await updateJobLog(editingJobLogId, data)
      setEditingJobLogId(null)
      getJobLogById(editingJobLogId)
    } catch {
      // Message is set on the job log store; banner shows below
    }
  }

  const handleStatusChange = async (status: 'active' | 'completed' | 'inactive') => {
    if (!selectedJobLog) return
    try {
      await updateJobLog(selectedJobLog.id, { status })
      getJobLogById(selectedJobLog.id)
    } catch {
      // Message is set on the job log store; banner shows below
    }
  }

  const handleTogglePin = async () => {
    if (!selectedJobLog) return
    setPinSaving(true)
    try {
      await updateJobLog(
        selectedJobLog.id,
        { pinned: !Boolean(selectedJobLog.pinnedAt) },
        { silent: true }
      )
    } catch {
      // Message is set on the job log store; banner shows below
    } finally {
      setPinSaving(false)
    }
  }

  const handleArchiveMenu = async () => {
    const meta = await loadSchedulingMeta()
    if (!meta) return
    if (meta.recurrenceId && (meta.occurrenceCount ?? 0) > 1) {
      setShowDeleteRecurringModal(true)
    } else {
      setShowArchiveConfirm(true)
    }
  }

  const handlePermanentMenu = async () => {
    const meta = await loadSchedulingMeta()
    if (!meta) return
    if (meta.recurrenceId && (meta.occurrenceCount ?? 0) > 1) {
      setShowPermanentDeleteRecurringModal(true)
    } else {
      setShowPermanentConfirm(true)
    }
  }

  const handleConfirmArchive = async () => {
    const meta = schedulingMeta
    if (!meta) return
    try {
      await archiveWorkspaceJobSingle(meta)
      setShowArchiveConfirm(false)
      // Non-recurring archive cascades to the job itself, so leave the detail page.
      navigate('/app/job-logs')
    } catch {
      // store error
    }
  }

  const handleArchiveOneRecurring = async () => {
    const meta = schedulingMeta
    if (!meta) return
    try {
      await archiveWorkspaceJobSingle(meta)
      setShowDeleteRecurringModal(false)
      // Only this occurrence's booking was archived; the job survives.
      await refreshAfterMutation()
    } catch {
      // store error
    }
  }

  const handleArchiveAllRecurring = async () => {
    const meta = schedulingMeta
    if (!meta) return
    try {
      await archiveWorkspaceJobRecurringAll(meta)
      setShowDeleteRecurringModal(false)
      navigate('/app/job-logs')
    } catch {
      // store error
    }
  }

  const handleConfirmPermanent = async () => {
    const meta = schedulingMeta
    if (!meta) return
    try {
      await permanentDeleteWorkspaceBookingOrJob(meta)
      setShowPermanentConfirm(false)
      if (meta.bookingId) {
        await refreshAfterMutation()
      } else {
        navigate('/app/job-logs')
      }
    } catch {
      // store error
    }
  }

  const handlePermanentOneRecurring = async () => {
    const meta = schedulingMeta
    if (!meta) return
    try {
      await permanentDeleteWorkspaceBookingOrJob(meta)
      setShowPermanentDeleteRecurringModal(false)
      await refreshAfterMutation()
    } catch {
      // store error
    }
  }

  const handlePermanentAllRecurring = async () => {
    setSentBanner({
      type: 'failed',
      message:
        'To permanently delete jobs, use the Jobs page. Scheduling can only delete bookings.',
    })
    setShowPermanentDeleteRecurringModal(false)
    setTimeout(() => setSentBanner(null), 8000)
  }

  if (!id) {
    navigate('/app/job-logs')
    return null
  }

  if (isLoading && !selectedJobLog) {
    return (
      <div className="space-y-6">
        <div
          className={cn(
            'h-10 w-64 rounded animate-pulse',
            theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
          )}
        />
        <div
          className={cn(
            'h-96 rounded-xl animate-pulse',
            theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
          )}
        />
      </div>
    )
  }

  if (!selectedJobLog || selectedJobLog.id !== id) {
    return (
      <div className="space-y-6">
        <p
          className={cn(
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}
        >
          Job not found.
        </p>
        <button onClick={() => navigate('/app/job-logs')} className="text-primary-gold hover:underline">
          Back to Jobs
        </button>
      </div>
    )
  }

  const meta = schedulingMeta
  const archiveTitle =
    meta?.bookingId && (meta?.toBeScheduled || !meta?.startTime) ? 'Delete Booking?' : 'Archive Job?'

  return (
    <div className="space-y-6">
      {metaLoading && (
        <p
          className={cn(
            'text-sm',
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}
        >
          Loading…
        </p>
      )}
      {jobLogSaveError && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-400">{jobLogSaveError}</p>
            <Button variant="ghost" size="sm" onClick={() => clearJobLogError()}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
      {sentBanner && (
        <Card
          className={
            sentBanner.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20'
              : 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20'
          }
        >
          <div className="flex items-center justify-between">
            <p
              className={
                sentBanner.type === 'success' ? 'text-sm text-green-400' : 'text-sm text-red-400'
              }
            >
              {sentBanner.type === 'success' ? '✓ ' : ''}
              {sentBanner.message}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSentBanner(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
      <JobLogDetail
        jobLog={selectedJobLog}
        onBack={handleBack}
        onEdit={() => setEditingJobLogId(selectedJobLog.id)}
        onArchiveRequest={handleArchiveMenu}
        onPermanentDeleteRequest={handlePermanentMenu}
        isEditing={editingJobLogId === selectedJobLog.id}
        onCancelEdit={() => setEditingJobLogId(null)}
        onSaveEdit={handleSaveEdit}
        onStatusChange={handleStatusChange}
        isLoading={isLoading}
        onTogglePin={handleTogglePin}
        pinSaving={pinSaving}
        onQuoteSent={message => {
          setSentBanner({ type: 'success', message })
          setTimeout(() => setSentBanner(null), 5000)
        }}
        onInvoiceSent={message => {
          setSentBanner({ type: 'success', message })
          setTimeout(() => setSentBanner(null), 5000)
        }}
      />

      {schedulingMeta && (
        <ConfirmationDialog
          isOpen={showArchiveConfirm}
          onClose={() => setShowArchiveConfirm(false)}
          onConfirm={handleConfirmArchive}
          title={archiveTitle}
          message={
            <div className="space-y-3">
              {schedulingMeta.bookingId ? (
                schedulingMeta.toBeScheduled || !schedulingMeta.startTime ? (
                  <>
                    <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
                      Are you sure you want to delete this booking?
                    </p>
                    <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
                      <p
                        className={cn(
                          'text-sm mb-2',
                          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                        )}
                      >
                        <strong
                          className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}
                        >
                          Important:
                        </strong>{' '}
                        This will only delete the booking, not the job itself.
                      </p>
                      <p
                        className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                        )}
                      >
                        The job &quot;{schedulingMeta.title}&quot; will remain in your jobs list and can be
                        scheduled again later.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
                      Are you sure you want to archive this job?
                    </p>
                    <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
                      <p
                        className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                        )}
                      >
                        <strong
                          className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}
                        >
                          Job:
                        </strong>{' '}
                        {schedulingMeta.title}
                      </p>
                      <p
                        className={cn(
                          'text-sm mt-1',
                          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                        )}
                      >
                        Archived jobs can be restored later from the Archived tab on Jobs or Calendar.
                      </p>
                    </div>
                  </>
                )
              ) : (
                <>
                  <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
                    Are you sure you want to archive this job?
                  </p>
                  <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
                    <p
                      className={cn(
                        'text-sm',
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}
                    >
                      <strong className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
                        Job:
                      </strong>{' '}
                      {schedulingMeta.title}
                    </p>
                    <p
                      className={cn(
                        'text-sm mt-1',
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}
                    >
                      Archived jobs can be restored later from the Archived tab.
                    </p>
                  </div>
                </>
              )}
            </div>
          }
          confirmText={
            schedulingMeta.bookingId
              ? schedulingMeta.toBeScheduled || !schedulingMeta.startTime
                ? 'Delete Booking'
                : 'Archive'
              : 'Archive'
          }
          confirmVariant="danger"
        />
      )}

      {schedulingMeta && (
        <ConfirmationDialog
          isOpen={showPermanentConfirm}
          onClose={() => setShowPermanentConfirm(false)}
          onConfirm={handleConfirmPermanent}
          title="⚠️ Permanently Delete Job?"
          message={
            <div className="space-y-3">
              <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
                Are you sure you want to <strong className="text-red-400">PERMANENTLY</strong> remove this?
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p
                  className={cn(
                    'text-sm font-semibold mb-1',
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  )}
                >
                  ⚠️ This action cannot be undone!
                </p>
                <p
                  className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}
                >
                  {schedulingMeta.bookingId
                    ? 'The booking will be permanently removed.'
                    : 'The job and related data will be permanently removed.'}
                </p>
              </div>
              <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
                <p
                  className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}
                >
                  <strong
                    className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}
                  >
                    Job:
                  </strong>{' '}
                  {schedulingMeta.title}
                </p>
              </div>
            </div>
          }
          confirmText="Delete Permanently"
          confirmVariant="danger"
        />
      )}

      {schedulingMeta && (
        <DeleteRecurringJobModal
          isOpen={showDeleteRecurringModal}
          onClose={() => setShowDeleteRecurringModal(false)}
          onDeleteOne={handleArchiveOneRecurring}
          onDeleteAll={handleArchiveAllRecurring}
          jobTitle={schedulingMeta.title}
          occurrenceCount={schedulingMeta.occurrenceCount}
        />
      )}

      {schedulingMeta && (
        <PermanentDeleteRecurringJobModal
          isOpen={showPermanentDeleteRecurringModal}
          onClose={() => setShowPermanentDeleteRecurringModal(false)}
          onDeleteOne={handlePermanentOneRecurring}
          onDeleteAll={handlePermanentAllRecurring}
          jobTitle={schedulingMeta.title}
          occurrenceCount={schedulingMeta.occurrenceCount}
          isArchived={Boolean(schedulingMeta.archivedAt)}
        />
      )}
    </div>
  )
}

export default JobLogDetailPage
