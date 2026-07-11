import { useState } from 'react'
import { format } from 'date-fns'
import { AppButton, AppModal, DateField } from './jobLogsUi'

export interface PayChangeEffectiveDateModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (effectiveDate: string) => void
  isLoading?: boolean
}

export function PayChangeEffectiveDateModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: PayChangeEffectiveDateModalProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [effectiveDate, setEffectiveDate] = useState<string>(() =>
    format(today, 'yyyy-MM-dd')
  )

  const handleConfirm = () => {
    onConfirm(effectiveDate)
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Effective date for pay change"
      size="sm"
      fullScreenOnMobile={false}
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </AppButton>
          <AppButton onClick={handleConfirm} disabled={isLoading} isLoading={isLoading}>
            {isLoading ? 'Saving...' : 'Apply'}
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          When should this pay change take effect? Existing time entries before this date will keep
          their current rate. Entries on or after this date will use the new rate.
        </p>
        <DateField label="Effective date" value={effectiveDate} onChange={setEffectiveDate} />
      </div>
    </AppModal>
  )
}
