import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import Button from './Button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
}: ModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={cn(
          'relative w-full rounded-lg bg-primary-dark-secondary border border-primary-blue shadow-xl my-auto max-h-[95vh] sm:max-h-[90vh] flex flex-col',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || closeOnOverlayClick) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-primary-blue flex-shrink-0">
            {title && (
              <h2 className="text-lg sm:text-xl font-semibold text-primary-light pr-2">{title}</h2>
            )}
            {closeOnOverlayClick && (
              <button
                onClick={onClose}
                className="text-primary-light hover:text-primary-gold transition-colors flex-shrink-0"
                aria-label="Close modal"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-primary-blue flex-shrink-0">
            {footer}
          </div>
        )}
      </div>

      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default Modal

