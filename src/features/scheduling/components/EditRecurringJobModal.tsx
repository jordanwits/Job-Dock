import { AppButton, AppModal } from './schedulingUi'

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
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit recurring job?"
      size="md"
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} fullWidth className="sm:w-auto">
            Cancel
          </AppButton>
          <AppButton variant="subtle" onClick={onEditOne} fullWidth className="sm:w-auto">
            This job only
          </AppButton>
          <AppButton variant="primary" onClick={onEditAll} fullWidth className="sm:w-auto">
            All future jobs
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          This job is part of a recurring series
          {occurrenceCount ? ` with ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}` : ''}.
          Would you like to edit just this job, or all future jobs in the series?
        </p>

        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-sm text-ink-muted">
            <strong className="text-ink">Job:</strong> {jobTitle}
          </p>
        </div>
      </div>
    </AppModal>
  )
}

export default EditRecurringJobModal
