import { Modal } from '@/components/ui'
import { useJobStore } from '../store/jobStore'
import JobForm from './JobForm'
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
  onSuccess?: (createdJob?: Job) => void
  allowLinkExistingJob?: boolean // When true, show option to link to existing job
  existingJobId?: string // Pre-selected existing job ID
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
  allowLinkExistingJob = false,
  existingJobId,
}: ScheduleJobModalProps) => {
  const { createJob, updateJob, isLoading, error, clearError } = useJobStore()

  const handleSubmit = async (data: CreateJobData, existingJobIdParam?: string) => {
    try {
      const jobIdToUpdate = existingJobIdParam || existingJobId
      
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
          onSuccess(updatedJob)
        }
      } else {
        // Create new job
        const jobData = {
          ...data,
          ...(quoteId && { quoteId }),
          ...(invoiceId && { invoiceId }),
        }
        const created = await createJob(jobData)
        clearError()
        onClose()
        // Call onSuccess which should show confirmation in parent component
        if (onSuccess) {
          onSuccess(created)
        }
      }
    } catch (error: any) {
      // Error will be displayed in the modal via error prop
      // Keep the modal open so user can fix the issue
    }
  }

  const handleCancel = () => {
    clearError()
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title="Schedule Job"
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
          allowLinkExistingJob={allowLinkExistingJob}
          existingJobId={existingJobId}
        />
      </Modal>
    </>
  )
}

export default ScheduleJobModal
