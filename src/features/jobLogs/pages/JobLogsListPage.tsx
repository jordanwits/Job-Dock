import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogList from '../components/JobLogList'
import JobLogForm from '../components/JobLogForm'
import { Alert, AppButton, AppModal, PlusIcon, Tabs } from '../components/jobLogsUi'
import type { CreateJobLogData } from '../types/jobLog'
import { useAuthStore } from '@/features/auth'
import { services } from '@/lib/api/services'
import ArchivedJobsPage from '@/features/scheduling/components/ArchivedJobsPage'
import JobDetail from '@/features/scheduling/components/JobDetail'
import PermanentDeleteRecurringJobModal from '@/features/scheduling/components/PermanentDeleteRecurringJobModal'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import type { Job } from '@/features/scheduling/types/job'

const JobLogsListPage = () => {
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
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Jobs</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create jobs, track time, capture photos, and take notes on jobsites
          </p>
        </div>
        {activeJobsTab === 'jobs' && user?.canCreateJobs !== false && (
          <AppButton onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
            <PlusIcon className="h-4 w-4" />
            Create job
          </AppButton>
        )}
      </div>

      <Tabs
        tabs={[
          { value: 'jobs', label: 'All jobs' },
          { value: 'archived', label: 'Archive' },
        ]}
        value={activeJobsTab}
        onChange={(v) => setJobsTab(v as 'jobs' | 'archived')}
      />

      {showJobError && (
        <Alert tone="danger" onDismiss={() => setShowJobError(false)}>
          {jobErrorMessage}
        </Alert>
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

      <AppModal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="New job"
        size="xl"
      >
        <JobLogForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isLoading}
          isSimpleCreate={true}
        />
      </AppModal>

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
        <AppModal
          isOpen={showPermanentDeleteConfirm}
          onClose={() => setShowPermanentDeleteConfirm(false)}
          title="Permanently delete job?"
          size="md"
          footer={
            <>
              <AppButton variant="ghost" onClick={() => setShowPermanentDeleteConfirm(false)}>
                Cancel
              </AppButton>
              <AppButton variant="danger" onClick={handleConfirmPermanentDelete}>
                Delete permanently
              </AppButton>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink">
              Are you sure you want to <strong className="text-danger">permanently</strong> delete this job?
            </p>
            <div className="rounded-xl border border-danger/30 bg-danger-soft p-3">
              <p className="text-sm font-semibold text-danger">This action cannot be undone</p>
              <p className="mt-1 text-sm text-ink-muted">
                The job will be removed from the database
                {schedulingDetailJob.archivedAt ? ' and S3 archive' : ''}.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-sm text-ink-muted">
                <strong className="text-ink">Job:</strong> {schedulingDetailJob.title}
              </p>
            </div>
          </div>
        </AppModal>
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
          context="jobs"
        />
      )}
    </div>
  )
}

export default JobLogsListPage
