import { useState } from 'react'
import { Modal, ConfirmationDialog } from '@/components/ui'
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

interface ConflictInfo {
  id: string
  title: string
  startTime: string
  endTime: string
  contactName: string
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
  const { createJob, isLoading, error, clearError } = useJobStore()
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [pendingJobData, setPendingJobData] = useState<CreateJobData | null>(null)

  const handleSubmit = async (data: CreateJobData, forceBooking = false) => {
    try {
      // Add quoteId/invoiceId to the job data if provided
      const jobData = {
        ...data,
        ...(quoteId && { quoteId }),
        ...(invoiceId && { invoiceId }),
        ...(forceBooking && { forceBooking: true }),
      }
      await createJob(jobData)
      clearError()
      setConflicts([])
      setShowConflictDialog(false)
      setPendingJobData(null)
      onClose()
      // Call onSuccess which should show confirmation in parent component
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      // Check if this is a conflict error
      if (error.statusCode === 409 && error.conflicts && !forceBooking) {
        // Clear the regular error and show conflict dialog instead
        clearError()
        setConflicts(error.conflicts)
        setPendingJobData(data)
        setShowConflictDialog(true)
      }
      // Error will be displayed in the modal via error prop
      // Keep the modal open so user can fix the issue
    }
  }

  const handleConfirmDoubleBooking = async () => {
    if (pendingJobData) {
      await handleSubmit(pendingJobData, true)
    }
  }

  const handleCancelDoubleBooking = () => {
    setShowConflictDialog(false)
    setConflicts([])
    setPendingJobData(null)
  }

  const handleCancel = () => {
    clearError()
    setConflicts([])
    setShowConflictDialog(false)
    setPendingJobData(null)
    onClose()
  }

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
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
          error={error && !showConflictDialog ? error : null}
          defaultContactId={defaultContactId}
          defaultTitle={defaultTitle}
          defaultNotes={defaultNotes}
          initialQuoteId={initialQuoteId}
          initialInvoiceId={initialInvoiceId}
        />
      </Modal>

      <ConfirmationDialog
        isOpen={showConflictDialog}
        onClose={handleCancelDoubleBooking}
        onConfirm={handleConfirmDoubleBooking}
        title="⚠️ Double Booking Detected"
        confirmText="Book Anyway"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={isLoading}
        message={
          <div className="space-y-4">
            <p className="text-sm">
              This time slot conflicts with the following existing job{conflicts.length > 1 ? 's' : ''}:
            </p>
            <div className="bg-primary-dark-tertiary rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="border border-amber-500/30 rounded p-2 bg-amber-500/5">
                  <div className="font-medium text-amber-400">{conflict.title}</div>
                  <div className="text-xs text-primary-light/80 mt-1">
                    {conflict.contactName}
                  </div>
                  <div className="text-xs text-primary-light/60 mt-1">
                    {formatDateTime(conflict.startTime)} - {formatDateTime(conflict.endTime)}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-amber-400">
              Are you sure you want to create this double booking?
            </p>
          </div>
        }
      />
    </>
  )
}

export default ScheduleJobModal
