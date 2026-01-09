import { Modal, Button } from '@/components/ui'

interface DeleteRecurringJobModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleteOne: () => void
  onDeleteAll: () => void
  jobTitle: string
  occurrenceCount?: number
}

const DeleteRecurringJobModal = ({
  isOpen,
  onClose,
  onDeleteOne,
  onDeleteAll,
  jobTitle,
  occurrenceCount,
}: DeleteRecurringJobModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Recurring Job"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-primary-light">
          This job is part of a recurring series{occurrenceCount ? ` with ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}` : ''}.
        </p>
        <p className="text-primary-light">
          Would you like to delete just this job, or all jobs in the series?
        </p>
        
        <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
          <p className="text-sm text-primary-light/70">
            <strong className="text-primary-light">Job:</strong> {jobTitle}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
        <Button 
          variant="ghost" 
          onClick={onClose}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button 
          variant="ghost"
          onClick={onDeleteOne}
          className="w-full sm:w-auto text-orange-500 hover:text-orange-600"
        >
          This Job Only
        </Button>
        <Button 
          size="lg"
          onClick={onDeleteAll}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
        >
          Delete All
        </Button>
      </div>
    </Modal>
  )
}

export default DeleteRecurringJobModal
