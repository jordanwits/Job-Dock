import { useEffect, useMemo, useState } from 'react'
import { useSavedLineItemStore } from '@/features/line-items/store/savedLineItemStore'
import {
  AppButton,
  AppModal,
  SearchIcon,
  Spinner,
  TextField,
} from '@/features/line-items/components/lineItemsUi'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (line: { description: string; quantity: number; unitPrice: number }) => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export function PickSavedLineItemModal({ isOpen, onClose, onSelect }: Props) {
  const { items, fetchItems, isLoading } = useSavedLineItemStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (isOpen) {
      void fetchItems()
      setQuery('')
    }
  }, [isOpen, fetchItems])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q))
    )
  }, [items, query])

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Insert saved line item"
      size="lg"
      footer={
        <AppButton type="button" variant="ghost" onClick={onClose}>
          Cancel
        </AppButton>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Search"
          placeholder="Filter by name or description"
          value={query}
          onChange={e => setQuery(e.target.value)}
          leftIcon={<SearchIcon className="h-4 w-4" />}
        />
        <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-surface-2">
          {isLoading && (
            <p className="flex items-center gap-2 p-4 text-sm text-ink-muted">
              <Spinner className="text-accent-strong" />
              Loading…
            </p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="p-4 text-sm text-ink-muted">
              {items.length === 0
                ? 'No saved line items yet. Add them from the Line items button on the Quotes or Invoices page.'
                : 'No matches.'}
            </p>
          )}
          <ul className="divide-y divide-line">
            {filtered.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-ink transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  onClick={() => {
                    const description = item.description?.trim() ? item.description : item.name
                    onSelect({
                      description,
                      quantity: Number(item.defaultQuantity) || 1,
                      unitPrice: Number(item.unitPrice) || 0,
                    })
                    onClose()
                  }}
                >
                  <div className="font-medium text-ink">{item.name}</div>
                  {item.description ? (
                    <div className="truncate text-xs text-ink-subtle">{item.description}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-ink-muted">
                    Default qty <span className="font-mono tabular-nums">{item.defaultQuantity}</span> ·{' '}
                    <span className="font-mono tabular-nums">{formatCurrency(item.unitPrice)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppModal>
  )
}
