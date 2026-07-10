import { AppButton, AppModal } from './schedulingUi'

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
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete recurring appointment?"
      size="md"
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} fullWidth className="sm:w-auto">
            Cancel
          </AppButton>
          <AppButton variant="dangerGhost" onClick={onDeleteOne} fullWidth className="sm:w-auto">
            This appointment only
          </AppButton>
          <AppButton variant="danger" onClick={onDeleteAll} fullWidth className="sm:w-auto">
            Delete series
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          This appointment is part of a recurring series
          {occurrenceCount ? ` with ${occurrenceCount} appointment${occurrenceCount !== 1 ? 's' : ''}` : ''}.
          Deleting only this appointment keeps the job and the rest of the series on the calendar.
          Deleting the series removes every appointment in it from the calendar. The job itself stays
          on your Jobs page.
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

export default DeleteRecurringJobModal
