import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import Button from './Button'
import { useTheme } from '@/contexts/ThemeContext'

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
  const { theme } = useTheme()
  const scrollYRef = useRef(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  // Keep onClose ref up to date
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      // Prevent background scrolling on mobile (especially iOS Safari/standalone).
      // Using position: fixed is more reliable than overflow: hidden alone.
      // Height: 100% prevents layout jump in iOS standalone (no browser bars).
      scrollYRef.current = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.height = '100%'
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.height = ''
      document.body.style.overflow = 'unset'
      window.scrollTo(0, scrollYRef.current)
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.height = ''
      document.body.style.overflow = 'unset'
      window.scrollTo(0, scrollYRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Set up direct event listeners for close button to ensure it always works
  useEffect(() => {
    const button = closeButtonRef.current
    if (!button || !isOpen) return

    const handleClose = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      onCloseRef.current()
    }

    // Use capture phase to ensure we get the event first
    button.addEventListener('click', handleClose, { capture: true })
    button.addEventListener('touchend', handleClose, { capture: true, passive: false })

    return () => {
      button.removeEventListener('click', handleClose, { capture: true })
      button.removeEventListener('touchend', handleClose, { capture: true })
    }
  }, [isOpen])

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
        // Safe-area padding for iOS standalone - do NOT extend wrapper (keeps modal on-screen for scrolling)
        'fixed inset-0 z-50 flex overscroll-contain',
        'pt-[max(0.5rem,env(safe-area-inset-top,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]',
        'pb-0 pl-[max(0.5rem,env(safe-area-inset-left,0px))]',
        'sm:pt-4 sm:pr-4 sm:pb-4 sm:pl-4',
        'lg:pl-64', // Offset for sidebar so modal centers on main content area
        mobilePosition === 'bottom'
          ? 'items-end sm:items-center justify-center'
          : 'items-center justify-center sm:overflow-y-auto'
      )}
      onMouseDown={
        closeOnOverlayClick
          ? e => {
              if (e.target === e.currentTarget) onClose()
            }
          : undefined
      }
    >
      <div
        className={cn(
          'relative w-full rounded-lg shadow-xl flex flex-col',
          theme === 'dark'
            ? 'bg-primary-dark-secondary border border-primary-blue'
            : 'bg-white border border-gray-200',
          // Slightly under viewport for margin; svh fallback for older browsers
          mobilePosition === 'bottom'
            ? size === 'sm'
              ? 'max-h-viewport-mobile sm:h-auto sm:max-h-[85vh] sm:my-auto'
              : 'h-viewport-mobile sm:h-auto sm:max-h-[85vh] sm:my-auto'
            : size === 'sm'
              ? 'my-auto max-h-viewport-mobile sm:h-auto sm:max-h-[85vh]'
              : 'my-auto h-viewport-mobile sm:h-auto sm:max-h-[85vh]',
          sizeClass
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        {(title || headerRight || closeOnOverlayClick) && (
          <div className={cn(
            "flex items-center justify-between gap-2 p-4 sm:p-6 border-b flex-shrink-0 relative z-20 pointer-events-auto",
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200/20'
          )}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {title && (
                <h2 className={cn(
                  "text-lg sm:text-xl font-semibold shrink-0",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  {title}
                </h2>
              )}
              {headerRight && (
                <span className={cn(
                  "text-sm shrink-0",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>{headerRight}</span>
              )}
            </div>
            {closeOnOverlayClick && (
              <button
                ref={closeButtonRef}
                className={cn(
                  "hover:text-primary-gold transition-colors flex-shrink-0 touch-manipulation relative z-10",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  cursor: 'pointer',
                }}
                aria-label="Close modal"
                type="button"
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

        {/* Content - Scrollable. pb-8 on mobile ensures last items can scroll into view; touch for iOS */}
        <div
          className="p-4 sm:p-6 pb-8 sm:pb-6 overflow-y-auto overflow-x-hidden flex-1 min-h-0 custom-scrollbar touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={cn(
            "flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 sm:py-5 border-t flex-shrink-0 overflow-visible",
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200/20'
          )}>
            {footer}
          </div>
        )}
      </div>

      {/* Overlay - extends past bottom to cover iOS home indicator (prevents dark blue bar in standalone) */}
      <div
        className={cn(
          'fixed -z-10 inset-0',
          'max-sm:bottom-[calc(-1*env(safe-area-inset-bottom,0px)-2rem)]',
          transparentBackdrop ? 'bg-black/20' : 'bg-black/50 backdrop-blur-sm'
        )}
        onMouseDown={closeOnOverlayClick ? onClose : undefined}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default Modal
