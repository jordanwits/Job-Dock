import { AppButton, AppModal } from './schedulingUi'

interface PermanentDeleteRecurringJobModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleteOne: () => void
  onDeleteAll: () => void
  jobTitle: string
  occurrenceCount?: number
  isArchived?: boolean
  /**
   * 'calendar': deleting appointments (bookings) — the job itself is untouched.
   * 'jobs': deleting the job records themselves from the Jobs page.
   */
  context?: 'calendar' | 'jobs'
}

const PermanentDeleteRecurringJobModal = ({
  isOpen,
  onClose,
  onDeleteOne,
  onDeleteAll,
  jobTitle,
  occurrenceCount,
  isArchived,
  context = 'calendar',
}: PermanentDeleteRecurringJobModalProps) => {
  const isCalendar = context === 'calendar'
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={isCalendar ? 'Permanently delete appointment?' : 'Permanently delete recurring job?'}
      size="md"
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} fullWidth className="sm:w-auto">
            Cancel
          </AppButton>
          <AppButton variant="dangerGhost" onClick={onDeleteOne} fullWidth className="sm:w-auto">
            {isCalendar ? 'This appointment only' : 'This job only'}
          </AppButton>
          <AppButton variant="danger" onClick={onDeleteAll} fullWidth className="sm:w-auto">
            {isCalendar ? 'Delete series' : 'Delete all'}
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-3">
          <p className="text-sm font-semibold text-danger">This action cannot be undone</p>
          <p className="mt-1 text-sm text-ink-muted">
            {isCalendar
              ? 'This will permanently remove the appointment from the database.'
              : `This will permanently remove the job${occurrenceCount && occurrenceCount > 1 ? 's' : ''} from the database${isArchived ? ' and S3 archive' : ''}.`}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">
          {isCalendar ? (
            <>
              This appointment is part of a recurring series
              {occurrenceCount
                ? ` with ${occurrenceCount} appointment${occurrenceCount !== 1 ? 's' : ''}`
                : ''}
              . Deleting only this appointment keeps the job and the rest of the series. The job
              itself stays on your Jobs page.
            </>
          ) : (
            <>
              This job is part of a recurring series
              {occurrenceCount
                ? ` with ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}`
                : ''}
              . Would you like to permanently delete just this job, or all jobs in the series?
            </>
          )}
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

export default PermanentDeleteRecurringJobModal
