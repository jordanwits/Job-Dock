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
  // The booking the notify prompt is deciding on. `new` = create job, `independent` = create
  // standalone appointment, `linked` = schedule an existing job. All three ask before booking.
  const [pendingAction, setPendingAction] = useState<
    { kind: 'new' | 'independent' | 'linked'; data: CreateJobData; jobId?: string } | null
  >(null)

  // Schedule an existing (linked) job, optionally notifying the client of the new appointment.
  const performLinkedUpdate = async (jobId: string, data: CreateJobData, notifyClient: boolean) => {
    await updateJob({
      id: jobId,
      ...data,
      notifyClient,
      ...(quoteId && { quoteId }),
      ...(invoiceId && { invoiceId }),
    })
    clearError()
    onClose()
    // Fetch the updated job to pass to onSuccess
    await useJobStore.getState().getJobById(jobId)
    const updatedJob = useJobStore.getState().selectedJob
    if (onSuccess && updatedJob) {
      onSuccess(updatedJob, { action: 'linked', notifySent: notifyClient })
    }
  }

  const handleSubmit = async (data: CreateJobData, existingJobIdParam?: string, isIndependent?: boolean) => {
    const jobIdToUpdate = existingJobIdParam || existingJobId
    // A scheduled, confirmed appointment is the only kind worth a notification: tentative
    // (pending-confirmation) and to-be-scheduled bookings have no firm time to tell the client about.
    const isScheduledCreate = !!(data.startTime && data.endTime && !data.toBeScheduled)
    const isConfirmed = data.status !== 'pending-confirmation'

    try {
      if (isIndependent) {
        // Only prompt when there's a contact to notify.
        const hasContact = !!(data.contactId && String(data.contactId).trim())
        if (isScheduledCreate && isConfirmed && hasContact) {
          setPendingAction({ kind: 'independent', data })
          setShowNotifyClientModal(true)
          return
        }
        const created = await createIndependentBooking(data)
        clearError()
        onClose()
        if (onSuccess) {
          onSuccess(created, { action: 'independent' })
        }
        return
      }
      if (jobIdToUpdate) {
        // Scheduling an existing job books a new appointment — ask before notifying.
        if (isScheduledCreate && isConfirmed) {
          setPendingAction({ kind: 'linked', data, jobId: jobIdToUpdate })
          setShowNotifyClientModal(true)
          return
        }
        await performLinkedUpdate(jobIdToUpdate, data, false)
      } else {
        // Create new job - ask about notifying client if it's a scheduled appointment.
        // Unconfirmed appointments are tentative, so they skip the notify prompt entirely.
        if (isScheduledCreate && isConfirmed) {
          setPendingAction({ kind: 'new', data })
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

  const performPendingAction = async (notifyClient: boolean) => {
    // notifySubmitting guards double-click on Yes/No (and Esc/backdrop close,
    // which also books) — without it a slow create fires twice and books twice.
    if (!pendingAction || notifySubmitting) return
    setNotifySubmitting(true)
    try {
      const { kind, data, jobId } = pendingAction
      if (kind === 'independent') {
        const created = await createIndependentBooking({ ...data, notifyClient })
        clearError()
        setShowNotifyClientModal(false)
        setPendingAction(null)
        onClose()
        if (onSuccess) {
          onSuccess(created, { notifySent: notifyClient, action: 'independent' })
        }
      } else if (kind === 'linked' && jobId) {
        await performLinkedUpdate(jobId, data, notifyClient)
        setShowNotifyClientModal(false)
        setPendingAction(null)
      } else {
        const created = await createJob({
          ...data,
          notifyClient,
          ...(quoteId && { quoteId }),
          ...(invoiceId && { invoiceId }),
        })
        clearError()
        setShowNotifyClientModal(false)
        setPendingAction(null)
        onClose()
        if (onSuccess) {
          onSuccess(created, { notifySent: notifyClient, action: 'new' })
        }
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
          performPendingAction(false)
        }}
        onNotify={notify => {
          performPendingAction(notify)
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
