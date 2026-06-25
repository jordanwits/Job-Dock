import { AppButton, AppModal } from './schedulingUi'

interface NotifyClientModalProps {
  isOpen: boolean
  onClose: () => void
  onNotify: (notify: boolean) => void
  isLoading?: boolean
  /** Custom message - e.g. for create vs update flows */
  message?: string
}

const NotifyClientModal = ({
  isOpen,
  onClose,
  onNotify,
  isLoading = false,
  message = 'Would you like to notify the client about this schedule update?',
}: NotifyClientModalProps) => {
  const handleYes = () => {
    onNotify(true)
    // Parent handles closing in onNotify callback
  }

  const handleNo = () => {
    onNotify(false)
    // Parent handles closing in onNotify callback
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Notify the client?"
      size="sm"
      footer={
        <>
          <AppButton variant="subtle" onClick={handleNo} disabled={isLoading} fullWidth className="sm:w-auto">
            No
          </AppButton>
          <AppButton variant="primary" onClick={handleYes} isLoading={isLoading} fullWidth className="sm:w-auto">
            Yes
          </AppButton>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
    </AppModal>
  )
}

export default NotifyClientModal
