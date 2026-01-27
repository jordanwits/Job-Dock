import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MarketingSectionProps {
  children: ReactNode
  className?: string
  variant?: 'light' | 'white' | 'dark' | 'gradient-dark' | 'gradient-blue'
  withTopDivider?: boolean
  withBottomDivider?: boolean
  id?: string
}

const MarketingSection = ({
  children,
  className,
  variant = 'white',
  withTopDivider = false,
  withBottomDivider = false,
  id,
}: MarketingSectionProps) => {
  const variants = {
    light: 'bg-primary-light',
    white: 'bg-white',
    dark: 'bg-primary-dark text-white',
    'gradient-dark': 'bg-gradient-to-br from-primary-dark via-primary-dark-secondary to-primary-blue text-white',
    'gradient-blue': 'bg-gradient-to-br from-primary-blue/2 to-primary-light',
  }

  return (
    <section id={id} className={cn('relative py-16 md:py-24 overflow-hidden', variants[variant], className)}>
      {withTopDivider && <DividerTop />}
      {children}
      {withBottomDivider && <DividerBottom />}
    </section>
  )
}

const DividerTop = () => (
  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-gold/30 to-transparent" />
)

const DividerBottom = () => (
  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-gold/30 to-transparent" />
)

export default MarketingSection
