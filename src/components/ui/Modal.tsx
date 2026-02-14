import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import Button from './Button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  headerRight?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  closeOnOverlayClick?: boolean
  transparentBackdrop?: boolean
  mobilePosition?: 'center' | 'bottom'
}

const Modal = ({
  isOpen,
  onClose,
  title,
  headerRight,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  transparentBackdrop = false,
  mobilePosition = 'center',
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

  const sizes: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-[95vw] sm:max-w-[90vw] md:max-w-6xl lg:max-w-7xl',
  }

  const sizeClass = sizes[size] || sizes.md

  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex p-2 sm:p-4',
        'lg:pl-64', // Offset for sidebar so modal centers on main content area
        mobilePosition === 'bottom'
          ? 'items-end sm:items-center justify-center'
          : 'items-center justify-center overflow-y-auto'
      )}
      onMouseDown={closeOnOverlayClick ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
    >
      <div
        className={cn(
          'relative w-full rounded-lg bg-primary-dark-secondary border border-primary-blue shadow-xl flex flex-col',
          mobilePosition === 'bottom'
            ? 'max-h-[60vh] sm:max-h-[90vh] sm:my-auto'
            : 'my-auto max-h-[95vh] sm:max-h-[90vh]',
          sizeClass
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        {(title || headerRight || closeOnOverlayClick) && (
          <div className="flex items-center justify-between gap-2 p-4 sm:p-6 border-b border-primary-blue flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {title && (
                <h2 className="text-lg sm:text-xl font-semibold text-primary-light shrink-0">{title}</h2>
              )}
              {headerRight && (
                <span className="text-sm text-primary-light/70 shrink-0">{headerRight}</span>
              )}
            </div>
            {closeOnOverlayClick && (
              <button
                onClick={onClose}
                className="text-primary-light hover:text-primary-gold transition-colors flex-shrink-0"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 sm:py-5 border-t border-primary-blue flex-shrink-0">
            {footer}
          </div>
        )}
      </div>

      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 -z-10',
          transparentBackdrop ? 'bg-black/20' : 'bg-black/50 backdrop-blur-sm'
        )}
        onMouseDown={closeOnOverlayClick ? onClose : undefined}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default Modal
