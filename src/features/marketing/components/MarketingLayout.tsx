import { ReactNode } from 'react'
import MarketingHeader from './MarketingHeader'
import MarketingFooter from './MarketingFooter'

interface MarketingLayoutProps {
  children: ReactNode
  hideHeader?: boolean
  hideFooter?: boolean
}

const MarketingLayout = ({ children, hideHeader, hideFooter }: MarketingLayoutProps) => {
  return (
    <div className="min-h-screen bg-primary-light flex flex-col">
      {!hideHeader && <MarketingHeader />}
      <main className="flex-1">{children}</main>
      {!hideFooter && <MarketingFooter />}
    </div>
  )
}

export default MarketingLayout
