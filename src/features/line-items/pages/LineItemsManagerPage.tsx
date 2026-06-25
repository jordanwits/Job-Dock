import { useSearchParams, useNavigate } from 'react-router-dom'
import { AppButton, ChevronLeftIcon } from '@/features/line-items/components/lineItemsUi'
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
    <div className="mx-auto max-w-5xl space-y-6">
      <AppButton variant="ghost" onClick={handleBack} className="-ml-2 w-fit px-2">
        <ChevronLeftIcon className="h-5 w-5" />
        Back to {backTargetLabel(returnTo)}
      </AppButton>
      <SavedLineItemsSection />
    </div>
  )
}
