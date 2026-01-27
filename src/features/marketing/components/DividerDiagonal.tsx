import { cn } from '@/lib/utils'

interface DividerDiagonalProps {
  variant?: 'gold' | 'blue' | 'light'
  direction?: 'left' | 'right'
  className?: string
}

const DividerDiagonal = ({
  variant = 'gold',
  direction = 'right',
  className,
}: DividerDiagonalProps) => {
  const colors = {
    gold: 'text-primary-gold',
    blue: 'text-primary-blue',
    light: 'text-primary-light',
  }

  const paths = {
    right: 'M0,0 L1200,0 L0,100 Z',
    left: 'M0,0 L1200,0 L1200,100 Z',
  }

  return (
    <div className={cn('w-full overflow-hidden', className)}>
      <svg
        className={cn('w-full h-12 md:h-16', colors[variant])}
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={paths[direction]} fill="currentColor" />
      </svg>
    </div>
  )
}

export default DividerDiagonal
