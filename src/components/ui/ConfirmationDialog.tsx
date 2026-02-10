import { ReactNode, useState } from 'react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  isLoading?: boolean
}

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  isLoading = false,
}: ConfirmationDialogProps) => {
  const [isConfirming, setIsConfirming] = useState(false)
  const loading = isLoading || isConfirming

  const handleConfirm = async () => {
    const result = onConfirm()
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setIsConfirming(true)
      try {
        await (result as Promise<unknown>)
      } finally {
        setIsConfirming(false)
      }
    }
  }

  const footer = (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={loading}
        className="w-full sm:w-auto min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
      >
        {cancelText}
      </Button>
      <Button
        type="button"
        variant={confirmVariant}
        onClick={handleConfirm}
        isLoading={loading}
        className="w-full sm:w-auto min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
      >
        {confirmText}
      </Button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size="md"
      closeOnOverlayClick={!loading}
    >
      <div className="text-primary-light">{message}</div>
    </Modal>
  )
}

export default ConfirmationDialog
