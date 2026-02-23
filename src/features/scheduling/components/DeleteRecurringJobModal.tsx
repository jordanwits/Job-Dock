import { Modal, Button } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Recurring Job"
      size="md"
    >
      <div className="space-y-4">
        <p className={cn(
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>
          This job is part of a recurring series{occurrenceCount ? ` with ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}` : ''}.
        </p>
        <p className={cn(
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>
          Would you like to delete just this job, or all jobs in the series?
        </p>
        
        <div className={cn(
          "border rounded-lg p-3",
          theme === 'dark' 
            ? 'bg-primary-blue/10 border-primary-blue' 
            : 'bg-blue-50 border-blue-200'
        )}>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            <strong className={cn(
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>Job:</strong> {jobTitle}
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
          variant="ghost"
          onClick={onDeleteOne}
          className="w-full sm:w-auto text-orange-500 hover:text-orange-600 sm:flex-shrink-0"
        >
          This Job Only
        </Button>
        <Button 
          onClick={onDeleteAll}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white sm:flex-shrink-0"
        >
          Delete All
        </Button>
      </div>
    </Modal>
  )
}

export default DeleteRecurringJobModal
