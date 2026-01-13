import { useState, ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultCollapsed?: boolean
  actions?: ReactNode
}

export const CollapsibleSection = ({ 
  title, 
  children, 
  defaultCollapsed = true,
  actions 
}: CollapsibleSectionProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  return (
    <Card>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <svg 
            className={cn(
              "w-5 h-5 text-primary-light/70 transition-transform",
              !isCollapsed && "transform rotate-90"
            )}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7" 
            />
          </svg>
          <h2 className="text-xl font-semibold text-primary-light">
            {title}
          </h2>
        </div>
        {actions && (
          <div onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-4 pt-4 border-t border-primary-light/10">
          {children}
        </div>
      )}
    </Card>
  )
}
