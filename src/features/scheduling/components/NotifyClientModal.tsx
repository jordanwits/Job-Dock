import { Modal, Button } from '@/components/ui'

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

  const footer = (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleNo}
        disabled={isLoading}
        className="w-full sm:w-auto min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
      >
        No
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={handleYes}
        isLoading={isLoading}
        className="w-full sm:w-auto min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
      >
        Yes
      </Button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notify the client?"
      footer={footer}
      size="xs"
      compactOnMobile
      closeOnOverlayClick={!isLoading}
    >
      <p className="text-primary-light text-sm sm:text-base">
        {message}
      </p>
    </Modal>
  )
}

export default NotifyClientModal
