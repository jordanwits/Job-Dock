import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import { useSavedLineItemStore } from '@/features/line-items/store/savedLineItemStore'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (line: { description: string; quantity: number; unitPrice: number }) => void
}

export function PickSavedLineItemModal({ isOpen, onClose, onSelect }: Props) {
  const { theme } = useTheme()
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
    <Modal isOpen={isOpen} onClose={onClose} title="Insert saved line item" size="lg">
      <div className="space-y-4">
        <Input
          label="Search"
          placeholder="Filter by name or description"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div
          className={cn(
            'max-h-72 overflow-y-auto rounded-lg border',
            theme === 'dark' ? 'border-primary-light/15 bg-primary-dark/30' : 'border-gray-200 bg-white'
          )}
        >
          {isLoading && <p className="p-4 text-sm text-primary-light/60">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="p-4 text-sm text-primary-light/60">
              {items.length === 0
                ? 'No saved line items yet. Add them from the Line Items button on the Quotes or Invoices page.'
                : 'No matches.'}
            </p>
          )}
          <ul className="divide-y divide-primary-light/10">
            {filtered.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-primary-gold/10 transition-colors',
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}
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
                  <div className="font-medium">{item.name}</div>
                  {item.description ? (
                    <div className="text-xs text-primary-light/60 truncate">{item.description}</div>
                  ) : null}
                  <div className="text-xs text-primary-gold mt-1">
                    Default qty {item.defaultQuantity} ·{' '}
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      item.unitPrice
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
