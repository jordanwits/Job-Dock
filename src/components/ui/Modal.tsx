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
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  closeOnOverlayClick?: boolean
  transparentBackdrop?: boolean
  mobilePosition?: 'center' | 'bottom'
  /** Reduce padding on mobile for compact modals (e.g. simple confirmations) */
  compactOnMobile?: boolean
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
  compactOnMobile = false,
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
      // Use 100vh to avoid iOS standalone/PWA bottom gaps when body is fixed.
      scrollYRef.current = window.scrollY
      document.documentElement.style.height = '100vh'
      document.documentElement.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.height = '100vh'
      document.body.style.overflow = 'hidden'
    } else {
      document.documentElement.style.height = ''
      document.documentElement.style.overflow = ''
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
      document.documentElement.style.height = ''
      document.documentElement.style.overflow = ''
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
    xs: 'max-w-[min(95vw,18rem)] sm:max-w-md',
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
        // Backdrop on wrapper prevents body (#0B132B) from showing as blue bar in Safari standalone/PWA on iPhone.
        // On mobile, extend bottom past viewport to cover iOS standalone gap (100dvh can leave strip at bottom).
        'fixed inset-0 z-50 flex overscroll-contain',
        'max-sm:bottom-[calc(-1*env(safe-area-inset-bottom,0px)-4rem)]',
        transparentBackdrop
          ? 'bg-black/20'
          : theme === 'dark'
            ? 'max-sm:bg-black/60 sm:bg-black/50'
            : 'max-sm:bg-black/40 sm:bg-black/30',
        // Use symmetric vertical padding so centering is visually centered on iPhones
        // (safe-area-inset-top is larger than bottom, which otherwise shifts the "center" down).
        'py-[max(0.75rem,env(safe-area-inset-top,0px),env(safe-area-inset-bottom,0px))]',
        'pr-[max(0.75rem,env(safe-area-inset-right,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))]',
        'min-h-[100dvh]',
        'sm:pt-4 sm:pr-4 sm:pb-4 sm:pl-4',
        'lg:pl-64', // Offset for sidebar so modal centers on main content area
        mobilePosition === 'bottom'
          ? 'items-end sm:items-center justify-center'
          : 'items-center justify-center overflow-y-auto'
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
          // Slightly under viewport for margin; lg/xl use same shorter height on mobile
          mobilePosition === 'bottom'
            ? (size === 'xs' || size === 'sm')
              ? 'max-h-viewport-mobile sm:h-auto sm:max-h-[85vh] sm:my-auto'
              : (size === 'lg' || size === 'xl')
                ? 'h-viewport-mobile-lg sm:h-auto sm:max-h-[85vh] sm:my-auto'
                : 'h-viewport-mobile sm:h-auto sm:max-h-[85vh] sm:my-auto'
            : (size === 'xs' || size === 'sm')
              ? 'my-auto max-h-viewport-mobile sm:h-auto sm:max-h-[85vh]'
              : (size === 'lg' || size === 'xl')
                ? 'my-auto h-viewport-mobile-lg sm:h-auto sm:max-h-[85vh]'
                : 'my-auto h-viewport-mobile sm:h-auto sm:max-h-[85vh]',
          sizeClass
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        {(title || headerRight || closeOnOverlayClick) && (
          <div className={cn(
            "flex items-center justify-between gap-2 border-b flex-shrink-0 relative z-20 pointer-events-auto",
            compactOnMobile ? "p-3 sm:p-6" : "p-4 sm:p-6",
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200/20'
          )}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {title && (
                <h2 className={cn(
                  "font-semibold shrink-0",
                  compactOnMobile ? "text-base sm:text-xl" : "text-lg sm:text-xl",
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
          className={cn(
            "overflow-y-auto overflow-x-hidden flex-1 min-h-0 custom-scrollbar touch-pan-y",
            compactOnMobile ? "p-3 pb-6 sm:p-6 sm:pb-6" : "p-4 sm:p-6 pb-8 sm:pb-6"
          )}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={cn(
            "flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 border-t flex-shrink-0 overflow-visible",
            compactOnMobile ? "px-3 py-3 sm:px-6 sm:py-5" : "px-4 sm:px-6 py-4 sm:py-5",
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200/20'
          )}>
            {footer}
          </div>
        )}
      </div>

      {/* Overlay - extends past bottom to cover iOS home indicator (prevents blue bar in standalone) */}
      <div
        className={cn(
          'fixed -z-10 inset-0',
          'max-sm:bottom-[calc(-1*env(safe-area-inset-bottom,0px)-4rem)]',
          transparentBackdrop
            ? 'bg-black/20'
            : theme === 'dark'
              ? 'max-sm:bg-black/60 sm:bg-black/50 sm:backdrop-blur-sm'
              : 'max-sm:bg-black/40 sm:bg-black/30 sm:backdrop-blur-sm'
        )}
        onMouseDown={closeOnOverlayClick ? onClose : undefined}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default Modal
