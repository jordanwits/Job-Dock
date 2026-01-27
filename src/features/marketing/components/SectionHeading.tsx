import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow?: string
  heading: string | ReactNode
  subheading?: string
  align?: 'left' | 'center'
  className?: string
  headingClassName?: string
}

const SectionHeading = ({
  eyebrow,
  heading,
  subheading,
  align = 'center',
  className,
  headingClassName,
}: SectionHeadingProps) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
  }

  return (
    <div className={cn('mb-12 md:mb-16', alignClasses[align], className)}>
      {eyebrow && (
        <div className="inline-block px-4 py-1.5 bg-primary-gold/10 text-primary-gold text-sm font-bold tracking-wider rounded-full mb-4 uppercase">
          {eyebrow}
        </div>
      )}
      <h2 className={cn(
        'text-3xl md:text-4xl lg:text-5xl font-bold text-primary-dark mb-6 leading-tight',
        headingClassName
      )}>
        {heading}
      </h2>
      {subheading && (
        <p className="text-lg md:text-xl text-primary-dark/70 max-w-3xl mx-auto leading-relaxed">
          {subheading}
        </p>
      )}
    </div>
  )
}

export default SectionHeading
