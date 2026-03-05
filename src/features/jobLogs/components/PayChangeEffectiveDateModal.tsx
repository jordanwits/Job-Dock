import { useState } from 'react'
import { format } from 'date-fns'
import { Modal, Button, DatePicker } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [effectiveDate, setEffectiveDate] = useState<string>(() =>
    format(today, 'yyyy-MM-dd')
  )

  const handleConfirm = () => {
    onConfirm(effectiveDate)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Effective date for pay change"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Apply'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p
          className={cn(
            'text-sm',
            theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
          )}
        >
          When should this pay change take effect? Existing time entries before this date will keep
          their current rate. Entries on or after this date will use the new rate.
        </p>
        <div>
          <label
            className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}
          >
            Effective date
          </label>
          <DatePicker value={effectiveDate} onChange={setEffectiveDate} />
        </div>
      </div>
    </Modal>
  )
}
