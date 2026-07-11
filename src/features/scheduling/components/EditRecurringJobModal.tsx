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
      title="Edit recurring appointment?"
      size="md"
      fullScreenOnMobile={false}
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} fullWidth className="sm:w-auto">
            Cancel
          </AppButton>
          <AppButton variant="subtle" onClick={onEditOne} fullWidth className="sm:w-auto">
            This appointment only
          </AppButton>
          <AppButton variant="primary" onClick={onEditAll} fullWidth className="sm:w-auto">
            All future appointments
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          This appointment is part of a recurring series
          {occurrenceCount ? ` with ${occurrenceCount} appointment${occurrenceCount !== 1 ? 's' : ''}` : ''}.
          Would you like to edit just this appointment, or all future appointments in the series?
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
