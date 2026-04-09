import { useEffect, useState } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, Button, Input, Modal, ConfirmationDialog } from '@/components/ui'
import { useSavedLineItemStore } from '@/features/line-items/store/savedLineItemStore'
import {
  savedLineItemCreateFormSchema,
  type SavedLineItemCreateFormData,
} from '@/features/line-items/schemas/savedLineItemSchemas'
import { ImportSavedLineItemsModal } from '@/features/line-items/components/ImportSavedLineItemsModal'
import { useTheme } from '@/contexts/ThemeContext'
import { savedLineItemsService } from '@/lib/api/services'
import { cn } from '@/lib/utils'

function UnitPriceInputGroup({
  registration,
  error,
  theme,
}: {
  registration: UseFormRegisterReturn<'unitPrice'>
  error?: string
  theme: string
}) {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur()
  }

  return (
    <div className="w-full">
      <label
        className={cn(
          'block text-sm font-medium mb-2',
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}
      >
        Unit price
      </label>
      <div
        className={cn(
          'flex h-10 w-full rounded-lg border overflow-hidden',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-gold focus-within:border-primary-gold',
          theme === 'dark'
            ? 'border-primary-blue bg-primary-dark-secondary'
            : 'border-gray-200 bg-white',
          error && 'border-red-500 focus-within:ring-red-500'
        )}
      >
        <span
          className={cn(
            'flex items-center px-3 text-sm font-medium shrink-0 border-r',
            theme === 'dark'
              ? 'border-primary-blue text-primary-gold'
              : 'border-gray-200 text-primary-lightTextSecondary'
          )}
          aria-hidden
        >
          $
        </span>
        <input
          type="number"
          step="0.01"
          className={cn(
            'flex-1 min-w-0 border-0 bg-transparent px-3 py-2 text-sm',
            'focus:outline-none focus:ring-0',
            '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            theme === 'dark'
              ? 'text-primary-light placeholder:text-primary-light/50'
              : 'text-primary-lightText placeholder:text-primary-lightTextSecondary'
          )}
          onWheel={handleWheel}
          {...registration}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}

export function SavedLineItemsSection() {
  const { theme } = useTheme()
  const { items, isLoading, error, fetchItems, createItem, clearError } = useSavedLineItemStore()
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    setSelectedIds(previous => {
      const remainingIds = new Set(items.map(item => item.id))
      const nextSelected = new Set(Array.from(previous).filter(id => remainingIds.has(id)))
      return nextSelected.size === previous.size ? previous : nextSelected
    })
  }, [items])

  const createForm = useForm<SavedLineItemCreateFormData>({
    resolver: zodResolver(savedLineItemCreateFormSchema),
    defaultValues: {
      description: '',
      defaultQuantity: 1,
      unitPrice: 0,
    },
  })

  const onCreateSubmit = createForm.handleSubmit(async data => {
    const created = await createItem({
      description: data.description.trim(),
      defaultQuantity: data.defaultQuantity,
      unitPrice: data.unitPrice,
    })
    if (created) {
      setCreateOpen(false)
      createForm.reset({
        description: '',
        defaultQuantity: 1,
        unitPrice: 0,
      })
    }
  })

  const toggleSelection = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set(items.map(item => item.id)))
  }

  const handleBulkDelete = async () => {
    try {
      setIsBulkDeleting(true)
      const idsToDelete = Array.from(selectedIds)
      const failedIds: string[] = []

      const batchSize = 5
      for (let index = 0; index < idsToDelete.length; index += batchSize) {
        const batch = idsToDelete.slice(index, index + batchSize)
        const results = await Promise.allSettled(batch.map(id => savedLineItemsService.delete(id)))

        results.forEach((result, batchIndex) => {
          if (result.status === 'rejected') {
            const failedId = batch[batchIndex]
            if (failedId) {
              failedIds.push(failedId)
            }
          }
        })
      }

      await fetchItems()
      setSelectedIds(new Set(failedIds))
      setShowBulkDeleteConfirm(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-light">Saved line items</h2>
        <p className="text-sm text-primary-light/60 mt-1 max-w-2xl">
          Reusable rows for quotes and invoices. Import from CSV or add items here. You can still enter
          one-off lines on each quote or invoice.
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30 p-4 flex justify-between items-center gap-4">
          <p className="text-red-400 text-sm">{error}</p>
          <Button variant="ghost" className="text-xs shrink-0" onClick={() => clearError()}>
            Dismiss
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            createForm.reset({
              description: '',
              defaultQuantity: 1,
              unitPrice: 0,
            })
            setCreateOpen(true)
          }}
          className="bg-primary-gold text-primary-dark"
        >
          Add item
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          Import CSV
        </Button>
        <Button variant="ghost" onClick={() => void fetchItems()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'text-sm',
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}
        >
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-gold">{selectedIds.size} selected</span>
          ) : (
            `${items.length} saved line item${items.length !== 1 ? 's' : ''}`
          )}
        </p>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      <Card
        className={cn(
          'overflow-hidden',
          theme === 'dark' ? 'border-white/10 bg-primary-dark-secondary/40' : 'border-gray-200'
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={cn(
                  'border-b text-left',
                  theme === 'dark' ? 'border-white/10 bg-primary-dark/50' : 'border-gray-200 bg-gray-50'
                )}
              >
                <th className="p-3 w-12">
                  <div
                    onClick={toggleSelectAll}
                    className={cn(
                      'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                      selectedIds.size === items.length && items.length > 0
                        ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                        : theme === 'dark'
                          ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                          : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
                    )}
                    aria-label={selectedIds.size === items.length && items.length > 0 ? 'Clear selection' : 'Select all items'}
                    role="button"
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleSelectAll()
                      }
                    }}
                  >
                    {selectedIds.size === items.length && items.length > 0 && (
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                        )}
                      />
                    )}
                  </div>
                </th>
                <th className="p-3 font-medium text-primary-gold">Description</th>
                <th className="p-3 font-medium text-primary-gold">Default qty</th>
                <th className="p-3 font-medium text-primary-gold">Unit price</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-primary-light/50">
                    No saved line items yet.
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b',
                    theme === 'dark' ? 'border-white/5' : 'border-gray-100'
                  )}
                >
                  <td className="p-3" onClick={event => event.stopPropagation()}>
                    <div
                      onClick={() => toggleSelection(item.id)}
                      className={cn(
                        'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                        selectedIds.has(item.id)
                          ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                          : theme === 'dark'
                            ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                            : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
                      )}
                      aria-label={
                        selectedIds.has(item.id)
                          ? `Deselect ${item.description || item.name}`
                          : `Select ${item.description || item.name}`
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleSelection(item.id)
                        }
                      }}
                    >
                      {selectedIds.has(item.id) && (
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full',
                            theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                          )}
                        />
                      )}
                    </div>
                  </td>
                  <td
                    className="p-3 text-primary-light font-medium max-w-xl truncate"
                    title={item.description || item.name}
                  >
                    {item.description || item.name}
                  </td>
                  <td className="p-3 text-primary-light/80">{item.defaultQuantity}</td>
                  <td className="p-3 text-primary-light/80">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      item.unitPrice
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false)
          createForm.reset({
            description: '',
            defaultQuantity: 1,
            unitPrice: 0,
          })
        }}
        title="New saved line item"
      >
        <form
          onSubmit={e => {
            e.preventDefault()
            void onCreateSubmit()
          }}
          className="space-y-4"
        >
          <Input
            label="Description *"
            {...createForm.register('description')}
            error={createForm.formState.errors.description?.message}
          />
          <Input
            label="Default quantity"
            type="number"
            step="0.01"
            {...createForm.register('defaultQuantity')}
            error={createForm.formState.errors.defaultQuantity?.message}
          />
          <UnitPriceInputGroup
            registration={createForm.register('unitPrice')}
            error={createForm.formState.errors.unitPrice?.message}
            theme={theme}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary-gold text-primary-dark">
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ImportSavedLineItemsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={() => void fetchItems()}
      />

      <ConfirmationDialog
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} saved line item${selectedIds.size !== 1 ? 's' : ''}`}
        message={
          <>
            This action cannot be undone. All selected saved line items will be permanently removed.
          </>
        }
        confirmText={isBulkDeleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  )
}
