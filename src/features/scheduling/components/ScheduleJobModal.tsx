import { Modal } from '@/components/ui'
import { useJobStore } from '../store/jobStore'
import JobForm from './JobForm'
import { CreateJobData } from '../types/job'

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
  onSuccess?: () => void
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
}: ScheduleJobModalProps) => {
  const { createJob, isLoading, error, clearError } = useJobStore()

  const handleSubmit = async (data: CreateJobData) => {
    try {
      // Add quoteId/invoiceId to the job data if provided
      const jobData = {
        ...data,
        ...(quoteId && { quoteId }),
        ...(invoiceId && { invoiceId }),
      }
      await createJob(jobData)
      clearError()
      onClose()
      // Call onSuccess which should show confirmation in parent component
      if (onSuccess) {
        onSuccess()
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
        />
      </Modal>
    </>
  )
}

export default ScheduleJobModal
