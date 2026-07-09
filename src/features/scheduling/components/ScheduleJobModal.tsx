import { useState } from 'react'
import { AppModal } from './schedulingUi'
import { useJobStore } from '../store/jobStore'
import JobForm from './JobForm'
import NotifyClientModal from './NotifyClientModal'
import { CreateJobData, Job } from '../types/job'

interface ScheduleJobModalProps {
  isOpen: boolean
  onClose: () => void
  defaultContactId?: string
  defaultTitle?: string
  defaultNotes?: string
  defaultLocation?: string
  defaultServiceId?: string
  defaultDescription?: string
  defaultPrice?: number
  sourceContext?: 'contact' | 'quote' | 'invoice' | 'job-followup'
  quoteId?: string
  invoiceId?: string
  initialQuoteId?: string
  initialInvoiceId?: string
  onSuccess?: (createdJob?: Job, options?: { notifySent?: boolean; action?: 'new' | 'linked' | 'independent' }) => void
  allowLinkExistingJob?: boolean // When true, show option to link to existing job
  existingJobId?: string // Pre-selected existing job ID
  defaultStatus?: Job['status'] // Pre-select the status on a NEW job (e.g. 'pending-confirmation' for unconfirmed scheduling)
}

const ScheduleJobModal = ({
  isOpen,
  onClose,
  defaultContactId,
  defaultTitle,
  defaultNotes,
  defaultLocation,
  defaultServiceId,
  defaultDescription,
  defaultPrice,
  sourceContext,
  quoteId,
  invoiceId,
  initialQuoteId,
  initialInvoiceId,
  onSuccess,
  allowLinkExistingJob,
  existingJobId,
  defaultStatus,
}: ScheduleJobModalProps) => {
  // Default to true when scheduling from contact context to match calendar page (Create New / Link / Independent options)
  const effectiveAllowLinkExistingJob = allowLinkExistingJob ?? (sourceContext === 'contact')
  const { createJob, createIndependentBooking, updateJob, isLoading, error, clearError } = useJobStore()
  const [showNotifyClientModal, setShowNotifyClientModal] = useState(false)
  const [notifySubmitting, setNotifySubmitting] = useState(false)
  const [pendingCreatePayload, setPendingCreatePayload] = useState<{ data: CreateJobData; existingJobIdParam?: string } | null>(null)

  const handleSubmit = async (data: CreateJobData, existingJobIdParam?: string, isIndependent?: boolean) => {
    const jobIdToUpdate = existingJobIdParam || existingJobId

    try {
      if (isIndependent) {
        await createIndependentBooking(data)
        clearError()
        onClose()
        if (onSuccess) {
          onSuccess(undefined, { action: 'independent' })
        }
        return
      }
      if (jobIdToUpdate) {
        // Update existing job instead of creating new one
        const jobData = {
          ...data,
          ...(quoteId && { quoteId }),
          ...(invoiceId && { invoiceId }),
        }
        await updateJob({
          id: jobIdToUpdate,
          ...jobData,
        })
        clearError()
        onClose()
        // Fetch the updated job to pass to onSuccess
        await useJobStore.getState().getJobById(jobIdToUpdate)
        const updatedJob = useJobStore.getState().selectedJob
        if (onSuccess && updatedJob) {
          onSuccess(updatedJob, { action: 'linked' })
        }
      } else {
        // Create new job - ask about notifying client if it's a scheduled appointment.
        // Unconfirmed appointments are tentative, so they skip the notify prompt entirely.
        const isScheduledCreate = data.startTime && data.endTime && !data.toBeScheduled
        if (isScheduledCreate && data.status !== 'pending-confirmation') {
          setPendingCreatePayload({ data, existingJobIdParam })
          setShowNotifyClientModal(true)
          return
        }
        const jobData = {
          ...data,
          ...(quoteId && { quoteId }),
          ...(invoiceId && { invoiceId }),
        }
        const created = await createJob(jobData)
        clearError()
        onClose()
        if (onSuccess) {
          onSuccess(created, { action: 'new' })
        }
      }
    } catch (error: any) {
      // Error will be displayed in the modal via error prop
      // Keep the modal open so user can fix the issue
    }
  }

  const performCreateWithNotify = async (notifyClient: boolean) => {
    // notifySubmitting guards double-click on Yes/No (and Esc/backdrop close,
    // which also creates) — without it a slow create fires twice and books twice.
    if (!pendingCreatePayload || notifySubmitting) return
    setNotifySubmitting(true)
    try {
      const jobData = {
        ...pendingCreatePayload.data,
        notifyClient,
        ...(quoteId && { quoteId }),
        ...(invoiceId && { invoiceId }),
      }
      const created = await createJob(jobData)
      clearError()
      setShowNotifyClientModal(false)
      setPendingCreatePayload(null)
      onClose()
      if (onSuccess) {
        onSuccess(created, { notifySent: notifyClient, action: 'new' })
      }
    } catch (error: any) {
      // Keep modal open on error
    } finally {
      setNotifySubmitting(false)
    }
  }

  const handleCancel = () => {
    clearError()
    onClose()
  }

  return (
    <>
      <NotifyClientModal
        isOpen={showNotifyClientModal}
        isLoading={notifySubmitting}
        message="Would you like to notify the client about this appointment?"
        onClose={() => {
          performCreateWithNotify(false)
        }}
        onNotify={notify => {
          performCreateWithNotify(notify)
        }}
      />
      <AppModal
        isOpen={isOpen}
        onClose={handleCancel}
        title="Schedule job"
        size="xl"
      >
        <JobForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
          error={error}
          defaultContactId={defaultContactId}
          defaultTitle={defaultTitle}
          defaultNotes={defaultNotes}
          defaultLocation={defaultLocation}
          defaultServiceId={defaultServiceId}
          defaultDescription={defaultDescription}
          defaultPrice={defaultPrice}
          initialQuoteId={initialQuoteId}
          initialInvoiceId={initialInvoiceId}
          allowLinkExistingJob={effectiveAllowLinkExistingJob}
          existingJobId={existingJobId}
          defaultStatus={defaultStatus}
          isSimpleCreate={false}
        />
      </AppModal>
    </>
  )
}

export default ScheduleJobModal
