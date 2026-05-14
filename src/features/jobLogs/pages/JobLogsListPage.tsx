import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogList from '../components/JobLogList'
import JobLogForm from '../components/JobLogForm'
import { Modal, Button, Card, ConfirmationDialog } from '@/components/ui'
import type { CreateJobLogData } from '../types/jobLog'
import { useAuthStore } from '@/features/auth'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { services } from '@/lib/api/services'
import ArchivedJobsPage from '@/features/scheduling/components/ArchivedJobsPage'
import JobDetail from '@/features/scheduling/components/JobDetail'
import PermanentDeleteRecurringJobModal from '@/features/scheduling/components/PermanentDeleteRecurringJobModal'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import type { Job } from '@/features/scheduling/types/job'

const JobLogsListPage = () => {
  const { theme } = useTheme()
  const { user } = useAuthStore()
  const [isTeamAccount, setIsTeamAccount] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeJobsTab = tabParam === 'archived' ? 'archived' : 'jobs'

  const setJobsTab = (tab: 'jobs' | 'archived') => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'archived') {
      next.set('tab', 'archived')
    } else {
      next.delete('tab')
    }
    setSearchParams(next, { replace: true })
  }

  const { restoreJob, fetchJobs, permanentDeleteJob } = useJobStore()

  const [schedulingDetailJob, setSchedulingDetailJob] = useState<Job | null>(null)
  const [showSchedulingJobDetail, setShowSchedulingJobDetail] = useState(false)
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false)
  const [showPermanentDeleteRecurringModal, setShowPermanentDeleteRecurringModal] = useState(false)
  const [deletedJobId, setDeletedJobId] = useState<string | null>(null)
  const [deletedRecurrenceId, setDeletedRecurrenceId] = useState<string | null>(null)
  const [showJobError, setShowJobError] = useState(false)
  const [jobErrorMessage, setJobErrorMessage] = useState('')

  useEffect(() => {
    const checkTeam = async () => {
      try {
        const status = await services.billing.getStatus()
        setIsTeamAccount(status.subscriptionTier === 'team' || status.subscriptionTier === 'team-plus')
      } catch {
        setIsTeamAccount(false)
      }
    }
    checkTeam()
  }, [])

  useEffect(() => {
    if (activeJobsTab !== 'archived') {
      setDeletedJobId(null)
      setDeletedRecurrenceId(null)
    }
  }, [activeJobsTab])

  const navigate = useNavigate()
  const { createJobLog, isLoading } = useJobLogStore()
  const [showCreateForm, setShowCreateForm] = useState(false)

  const closeSchedulingDetail = () => {
    setSchedulingDetailJob(null)
    setShowSchedulingJobDetail(false)
  }

  const handleRequestPermanentDelete = (job?: Job) => {
    const jobToDelete = job || schedulingDetailJob
    if (jobToDelete) {
      if (jobToDelete !== schedulingDetailJob) {
        setSchedulingDetailJob(jobToDelete)
      }
      if (jobToDelete.recurrenceId && (jobToDelete.occurrenceCount ?? 0) > 1) {
        setShowPermanentDeleteRecurringModal(true)
      } else {
        setShowPermanentDeleteConfirm(true)
      }
    }
  }

  const handleConfirmPermanentDelete = async () => {
    if (!schedulingDetailJob) return
    try {
      if (schedulingDetailJob.isIndependent && schedulingDetailJob.bookingId) {
        const { bookingsService } = await import('@/lib/api/services')
        await bookingsService.permanentDelete(schedulingDetailJob.bookingId)
        await fetchJobs()
      } else {
        await permanentDeleteJob(schedulingDetailJob.id)
      }
      setDeletedJobId(schedulingDetailJob.id)
      closeSchedulingDetail()
      setShowPermanentDeleteConfirm(false)
    } catch (error) {
      console.error('Error permanently deleting:', error)
    }
  }

  const handlePermanentDeleteSingleJob = async () => {
    if (!schedulingDetailJob) return
    try {
      if (schedulingDetailJob.isIndependent && schedulingDetailJob.bookingId) {
        const { bookingsService } = await import('@/lib/api/services')
        await bookingsService.permanentDelete(schedulingDetailJob.bookingId)
        await fetchJobs()
      } else {
        await permanentDeleteJob(schedulingDetailJob.id)
      }
      setDeletedJobId(schedulingDetailJob.id)
      closeSchedulingDetail()
      setShowPermanentDeleteRecurringModal(false)
    } catch (error) {
      console.error('Error permanently deleting:', error)
    }
  }

  const handlePermanentDeleteAllJobs = async () => {
    if (!schedulingDetailJob) return
    try {
      if (schedulingDetailJob.isIndependent && schedulingDetailJob.bookingId) {
        const { bookingsService } = await import('@/lib/api/services')
        await bookingsService.permanentDelete(schedulingDetailJob.bookingId)
        await fetchJobs()
        setDeletedJobId(schedulingDetailJob.id)
      } else {
        await permanentDeleteJob(schedulingDetailJob.id, true)
        setDeletedRecurrenceId(schedulingDetailJob.recurrenceId ?? null)
      }
      closeSchedulingDetail()
      setShowPermanentDeleteRecurringModal(false)
    } catch (error) {
      console.error('Error permanently deleting all jobs:', error)
    }
  }

  const handleRestoreSchedulingJob = async (job?: Job) => {
    const jobToRestore = job || schedulingDetailJob
    if (!jobToRestore) return
    try {
      await restoreJob(jobToRestore.id)
      setDeletedJobId(jobToRestore.id)
      if (schedulingDetailJob?.id === jobToRestore.id) {
        closeSchedulingDetail()
      }
    } catch (error) {
      console.error('Error restoring job:', error)
    }
  }

  // If we arrive with ?openJobId=..., auto-open that job and then clear the param.
  useEffect(() => {
    const openJobId = searchParams.get('openJobId')
    if (!openJobId) return

    // Clear param first (so refresh doesn't keep re-opening)
    const next = new URLSearchParams(searchParams)
    next.delete('openJobId')
    setSearchParams(next, { replace: true })

    navigate(`/app/job-logs/${openJobId}`)
  }, [navigate, searchParams, setSearchParams])

  const handleSelectJobLog = (id: string) => {
    navigate(`/app/job-logs/${id}`)
  }

  const handleCreate = async (data: CreateJobLogData) => {
    const created = await createJobLog(data)
    setShowCreateForm(false)
    navigate(`/app/job-logs/${created.id}`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1
            className={cn(
              'text-2xl md:text-3xl font-bold tracking-tight',
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}
          >
            <span className="text-primary-gold">Jobs</span>
          </h1>
          <p
            className={cn(
              'text-sm md:text-base',
              theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
            )}
          >
            Create jobs, track time, capture photos, and take notes on jobsites
          </p>
        </div>
        {activeJobsTab === 'jobs' && user?.canCreateJobs !== false && (
          <Button onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
            Create Job
          </Button>
        )}
      </div>

      <div
        className={cn(
          'flex items-center gap-1 sm:gap-2 border-b overflow-x-hidden overflow-y-hidden flex-shrink-0 min-w-0 -mx-4 md:-mx-6 px-4 md:px-6',
          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
        )}
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <button
          type="button"
          onClick={() => setJobsTab('jobs')}
          className={cn(
            'px-2.5 sm:px-3 md:px-4 py-2 font-medium transition-all whitespace-nowrap text-sm md:text-base flex-shrink-0',
            activeJobsTab === 'jobs'
              ? 'text-primary-gold border-b-2 border-primary-gold -mb-[1px]'
              : theme === 'dark'
                ? 'text-primary-light/60 hover:text-primary-light/90'
                : 'text-primary-lightTextSecondary hover:text-primary-lightText'
          )}
        >
          All jobs
        </button>
        <button
          type="button"
          onClick={() => setJobsTab('archived')}
          className={cn(
            'px-2.5 sm:px-3 md:px-4 py-2 font-medium transition-all whitespace-nowrap text-sm md:text-base flex-shrink-0',
            activeJobsTab === 'archived'
              ? 'text-primary-gold border-b-2 border-primary-gold -mb-[1px]'
              : theme === 'dark'
                ? 'text-primary-light/60 hover:text-primary-light/90'
                : 'text-primary-lightTextSecondary hover:text-primary-lightText'
          )}
        >
          Archive
        </button>
      </div>

      {showJobError && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-red-400">✗ {jobErrorMessage}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowJobError(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {activeJobsTab === 'jobs' ? (
        <JobLogList onCreateClick={() => setShowCreateForm(true)} onSelectJobLog={handleSelectJobLog} />
      ) : (
        <div className="min-h-[320px]">
          <ArchivedJobsPage
            onJobRestore={handleRestoreSchedulingJob}
            onJobSelect={job => {
              setSchedulingDetailJob(job)
              setShowSchedulingJobDetail(true)
            }}
            onPermanentDelete={job => {
              handleRequestPermanentDelete(job)
            }}
            deletedJobId={deletedJobId}
            deletedRecurrenceId={deletedRecurrenceId}
          />
        </div>
      )}

      <Modal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="New Job"
        size="xl"
        fitContentOnMobile
      >
        <JobLogForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isLoading}
          isSimpleCreate={true}
        />
      </Modal>

      {schedulingDetailJob && (
        <JobDetail
          job={schedulingDetailJob}
          isOpen={showSchedulingJobDetail}
          showCreatedBy={isTeamAccount}
          onClose={closeSchedulingDetail}
          onPermanentDelete={
            user?.role !== 'employee' || schedulingDetailJob.createdById === user?.id
              ? () => handleRequestPermanentDelete()
              : undefined
          }
          onRestore={
            !schedulingDetailJob.isIndependent &&
            (user?.role !== 'employee' || schedulingDetailJob.createdById === user?.id)
              ? () => handleRestoreSchedulingJob()
              : undefined
          }
        />
      )}

      {schedulingDetailJob && (
        <ConfirmationDialog
          isOpen={showPermanentDeleteConfirm}
          onClose={() => setShowPermanentDeleteConfirm(false)}
          onConfirm={handleConfirmPermanentDelete}
          title="⚠️ Permanently Delete Job?"
          message={
            <div className="space-y-3">
              <p className={theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'}>
                Are you sure you want to <strong className="text-red-400">PERMANENTLY</strong> delete
                this job?
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
                  The job will be removed from the database
                  {schedulingDetailJob.archivedAt ? ' and S3 archive' : ''}.
                </p>
              </div>
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
                  {schedulingDetailJob.title}
                </p>
              </div>
            </div>
          }
          confirmText="Delete Permanently"
          confirmVariant="danger"
        />
      )}

      {schedulingDetailJob && (
        <PermanentDeleteRecurringJobModal
          isOpen={showPermanentDeleteRecurringModal}
          onClose={() => setShowPermanentDeleteRecurringModal(false)}
          onDeleteOne={handlePermanentDeleteSingleJob}
          onDeleteAll={handlePermanentDeleteAllJobs}
          jobTitle={schedulingDetailJob.title}
          occurrenceCount={schedulingDetailJob.occurrenceCount}
          isArchived={!!schedulingDetailJob.archivedAt}
        />
      )}
    </div>
  )
}

export default JobLogsListPage
