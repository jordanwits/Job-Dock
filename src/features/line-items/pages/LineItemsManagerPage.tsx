import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { SavedLineItemsSection } from '@/features/line-items/components/SavedLineItemsSection'

function backTargetLabel(returnTo: string | null): string {
  if (!returnTo) return 'Quotes'
  const path = returnTo.split('?')[0]
  if (path === '/app/invoices') return 'Invoices'
  if (path === '/app/quotes') return 'Quotes'
  return 'previous page'
}

export function LineItemsManagerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = searchParams.get('returnTo')

  const handleBack = () => {
    if (returnTo && returnTo.startsWith('/app')) {
      navigate(returnTo)
      return
    }
    navigate('/app/quotes')
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={handleBack}
        className="flex items-center gap-2 -ml-2 w-fit px-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to {backTargetLabel(returnTo)}
      </Button>
      <SavedLineItemsSection />
    </div>
  )
}
