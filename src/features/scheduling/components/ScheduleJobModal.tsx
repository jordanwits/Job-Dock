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
    try {
      const date = new Date(dateTimeStr)
      if (isNaN(date.getTime())) {
        return 'Invalid Date'
      }
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch (error) {
      return 'Invalid Date'
    }
  }
  
  const formatTimeRange = (startTime: string, endTime: string) => {
    try {
      const start = new Date(startTime)
      const end = new Date(endTime)
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 'Invalid Date'
      }
      
      const startStr = start.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      
      const endStr = end.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      
      return `${startStr} - ${endStr}`
    } catch (error) {
      return 'Invalid Date'
    }
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
          defaultLocation={defaultLocation}
          defaultServiceId={defaultServiceId}
          defaultDescription={defaultDescription}
          defaultPrice={defaultPrice}
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
              You already have the following job{conflicts.length > 1 ? 's' : ''} scheduled for this time:
            </p>
            <div className="bg-primary-dark-tertiary rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="border border-amber-500/30 rounded p-2 bg-amber-500/5">
                  <div className="font-medium text-amber-400">{conflict.title}</div>
                  <div className="text-xs text-primary-light/80 mt-1">
                    {conflict.contactName}
                  </div>
                  <div className="text-xs text-primary-light/60 mt-1">
                    {formatTimeRange(conflict.startTime, conflict.endTime)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      />
    </>
  )
}

export default ScheduleJobModal
