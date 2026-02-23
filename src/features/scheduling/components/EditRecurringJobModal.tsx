import { Modal, Button } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Recurring Job"
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
          Would you like to edit just this job, or all future jobs in the series?
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
