import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface MarketingButtonProps {
  children: ReactNode
  to?: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'md' | 'lg'
  className?: string
  withArrow?: boolean
}

const MarketingButton = ({
  children,
  to,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  withArrow = false,
}: MarketingButtonProps) => {
  const baseStyles = 'group inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 hover:scale-105'
  
  const variants = {
    primary: 'bg-primary-gold hover:bg-primary-gold/90 text-primary-dark shadow-lg hover:shadow-xl',
    secondary: 'bg-white hover:bg-primary-light text-primary-dark border-2 border-primary-light',
    outline: 'bg-transparent border-2 border-white text-white hover:bg-white/10',
  }
  
  const sizes = {
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }

  const content = (
    <>
      {children}
      {withArrow && (
        <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      )}
    </>
  )

  const classes = cn(baseStyles, variants[variant], sizes[size], className)

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={classes}>
      {content}
    </button>
  )
}

export default MarketingButton
