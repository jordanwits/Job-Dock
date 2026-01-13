import { Modal, Button } from '@/components/ui'

interface PermanentDeleteRecurringJobModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleteOne: () => void
  onDeleteAll: () => void
  jobTitle: string
  occurrenceCount?: number
  isArchived?: boolean
}

const PermanentDeleteRecurringJobModal = ({
  isOpen,
  onClose,
  onDeleteOne,
  onDeleteAll,
  jobTitle,
  occurrenceCount,
  isArchived,
}: PermanentDeleteRecurringJobModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠️ Permanently Delete Recurring Job"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 font-semibold mb-2">
            ⚠️ Warning: This action cannot be undone!
          </p>
          <p className="text-primary-light/70 text-sm">
            This will permanently remove the job{occurrenceCount && occurrenceCount > 1 ? 's' : ''} from the database
            {isArchived ? ' and S3 archive' : ''}.
          </p>
        </div>

        <p className="text-primary-light">
          This job is part of a recurring series{occurrenceCount ? ` with ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}` : ''}.
        </p>
        <p className="text-primary-light">
          Would you like to permanently delete just this job, or all jobs in the series?
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
          className="w-full sm:w-auto text-red-500 hover:text-red-600"
        >
          Delete This Job Only
        </Button>
        <Button 
          size="lg"
          onClick={onDeleteAll}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
        >
          Delete All Permanently
        </Button>
      </div>
    </Modal>
  )
}

export default PermanentDeleteRecurringJobModal
