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
  sourceContext,
  quoteId,
  invoiceId,
  initialQuoteId,
  initialInvoiceId,
  onSuccess,
}: ScheduleJobModalProps) => {
  const { createJob, isLoading, clearError } = useJobStore()

  const handleSubmit = async (data: CreateJobData) => {
    try {
      // Add quoteId/invoiceId to the job data if provided
      const jobData = {
        ...data,
        ...(quoteId && { quoteId }),
        ...(invoiceId && { invoiceId }),
      }
      await createJob(jobData)
      onClose()
      // Call onSuccess which should show confirmation in parent component
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCancel = () => {
    clearError()
    onClose()
  }

  return (
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
        defaultContactId={defaultContactId}
        defaultTitle={defaultTitle}
        defaultNotes={defaultNotes}
        initialQuoteId={initialQuoteId}
        initialInvoiceId={initialInvoiceId}
      />
    </Modal>
  )
}

export default ScheduleJobModal
