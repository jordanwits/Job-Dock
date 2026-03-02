import { Modal, Button } from '@/components/ui'

interface NotifyClientModalProps {
  isOpen: boolean
  onClose: () => void
  onNotify: (notify: boolean) => void
  isLoading?: boolean
}

const NotifyClientModal = ({
  isOpen,
  onClose,
  onNotify,
  isLoading = false,
}: NotifyClientModalProps) => {
  const handleYes = () => {
    onNotify(true)
    onClose()
  }

  const handleNo = () => {
    onNotify(false)
    onClose()
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
        Would you like to notify the client about this schedule update?
      </p>
    </Modal>
  )
}

export default NotifyClientModal
