import { Modal, Button } from '@/components/ui'

interface EditRecurringJobModalProps {
  isOpen: boolean
  onClose: () => void
  onEditOne: () => void
  onEditAll: () => void
  jobTitle: string
  occurrenceCount?: number
}

const EditRecurringJobModal = ({
  isOpen,
  onClose,
  onEditOne,
  onEditAll,
  jobTitle,
  occurrenceCount,
}: EditRecurringJobModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Recurring Job"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-primary-light">
          This job is part of a recurring series{occurrenceCount ? ` with ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}` : ''}.
        </p>
        <p className="text-primary-light">
          Would you like to edit just this job, or all future jobs in the series?
        </p>
        
        <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
          <p className="text-sm text-primary-light/70">
            <strong className="text-primary-light">Job:</strong> {jobTitle}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:justify-end">
        <Button 
          variant="ghost" 
          onClick={onClose}
          className="w-full sm:w-auto sm:flex-shrink-0"
        >
          Cancel
        </Button>
        <Button 
          variant="secondary"
          onClick={onEditOne}
          className="w-full sm:w-auto sm:flex-shrink-0"
        >
          This Job Only
        </Button>
        <Button 
          variant="primary"
          onClick={onEditAll}
          className="w-full sm:w-auto sm:flex-shrink-0"
        >
          All Future Jobs
        </Button>
      </div>
    </Modal>
  )
}

export default EditRecurringJobModal
