import { ReactNode } from 'react'
import MarketingHeader from './MarketingHeader'
import MarketingFooter from './MarketingFooter'

interface MarketingLayoutProps {
  children: ReactNode
}

const MarketingLayout = ({ children }: MarketingLayoutProps) => {
  return (
    <div className="min-h-screen bg-primary-dark flex flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}

export default MarketingLayout
