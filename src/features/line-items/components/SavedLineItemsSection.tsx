import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSavedLineItemStore } from '@/features/line-items/store/savedLineItemStore'
import {
  savedLineItemCreateFormSchema,
  type SavedLineItemCreateFormData,
} from '@/features/line-items/schemas/savedLineItemSchemas'
import { ImportSavedLineItemsModal } from '@/features/line-items/components/ImportSavedLineItemsModal'
import { savedLineItemsService } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  EmptyState,
  PlusIcon,
  ReceiptIcon,
  SelectCircle,
  Spinner,
  TextField,
  TrashIcon,
  UploadIcon,
} from '@/features/line-items/components/lineItemsUi'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export function SavedLineItemsSection() {
  const { items, isLoading, error, fetchItems, createItem, clearError } = useSavedLineItemStore()
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (error && createOpen) {
      const id = requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return () => cancelAnimationFrame(id)
    }
  }, [error, createOpen])

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

  const allSelected = selectedIds.size === items.length && items.length > 0
  const thCls = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Saved line items</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Reusable rows for quotes and invoices. Import from CSV or add items here. You can still enter
          one-off lines on each quote or invoice.
        </p>
      </div>

      {error && !createOpen && (
        <Alert tone="danger" onDismiss={() => clearError()}>
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <AppButton
          onClick={() => {
            clearError()
            createForm.reset({
              description: '',
              defaultQuantity: 1,
              unitPrice: 0,
            })
            setCreateOpen(true)
          }}
        >
          <PlusIcon className="h-4 w-4" />
          Add item
        </AppButton>
        <AppButton variant="subtle" onClick={() => setImportOpen(true)}>
          <UploadIcon className="h-4 w-4" />
          Import CSV
        </AppButton>
        <AppButton variant="ghost" onClick={() => void fetchItems()} disabled={isLoading}>
          Refresh
        </AppButton>
      </div>

      <div className="flex min-h-[2.25rem] items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-accent-strong">
              <span className="font-mono tabular-nums">{selectedIds.size}</span> selected
            </span>
          ) : (
            <>
              <span className="font-mono tabular-nums text-ink">{items.length}</span>{' '}
              {items.length === 1 ? 'saved line item' : 'saved line items'}
            </>
          )}
        </p>
        {selectedIds.size > 0 && (
          <AppButton variant="dangerGhost" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
            <TrashIcon className="h-4 w-4" />
            Delete selected ({selectedIds.size})
          </AppButton>
        )}
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-muted">
          <Spinner className="text-accent-strong" />
          Loading line items...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon className="h-7 w-7" />}
          title="No saved line items yet. Add one or import a CSV to reuse it across quotes and invoices."
          action={
            <AppButton className="mt-1" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              Add item
            </AppButton>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <SelectCircle
                      selected={allSelected}
                      onClick={() => toggleSelectAll()}
                      label={allSelected ? 'Clear selection' : 'Select all items'}
                      className="mx-auto"
                    />
                  </th>
                  <th className={thCls}>Description</th>
                  <th className={cn(thCls, 'text-right')}>Quantity</th>
                  <th className={cn(thCls, 'text-right')}>Unit price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map(item => (
                  <tr key={item.id} className="bg-surface transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <SelectCircle
                        selected={selectedIds.has(item.id)}
                        onClick={() => toggleSelection(item.id)}
                        label={
                          selectedIds.has(item.id)
                            ? `Deselect ${item.description || item.name}`
                            : `Select ${item.description || item.name}`
                        }
                        className="mx-auto"
                      />
                    </td>
                    <td
                      className="max-w-xl truncate px-4 py-3 text-sm font-medium text-ink"
                      title={item.description || item.name}
                    >
                      {item.description || item.name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-ink-muted">
                      {item.defaultQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-ink">
                      {formatCurrency(item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AppModal
        isOpen={createOpen}
        onClose={() => {
          clearError()
          setCreateOpen(false)
          createForm.reset({
            description: '',
            defaultQuantity: 1,
            unitPrice: 0,
          })
        }}
        title="New saved line item"
        size="md"
        footer={
          <>
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => {
                clearError()
                setCreateOpen(false)
              }}
            >
              Cancel
            </AppButton>
            <AppButton type="submit" form="saved-line-item-form" isLoading={isLoading} disabled={isLoading}>
              Save
            </AppButton>
          </>
        }
      >
        <form
          id="saved-line-item-form"
          onSubmit={e => {
            e.preventDefault()
            void onCreateSubmit()
          }}
          className="space-y-4"
        >
          <TextField
            label="Description *"
            {...createForm.register('description')}
            error={createForm.formState.errors.description?.message}
          />
          <TextField
            label="Quantity"
            type="number"
            step="0.01"
            {...createForm.register('defaultQuantity')}
            error={createForm.formState.errors.defaultQuantity?.message}
          />
          <TextField
            label="Unit price"
            type="number"
            step="0.01"
            leftIcon={<span className="text-sm font-medium">$</span>}
            onWheel={e => e.currentTarget.blur()}
            {...createForm.register('unitPrice')}
            error={createForm.formState.errors.unitPrice?.message}
          />
          {error && (
            <div ref={errorRef}>
              <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                {error}
              </Alert>
            </div>
          )}
        </form>
      </AppModal>

      <ImportSavedLineItemsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={() => void fetchItems()}
      />

      <AppModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => !isBulkDeleting && setShowBulkDeleteConfirm(false)}
        title={`Delete ${selectedIds.size} saved line item${selectedIds.size !== 1 ? 's' : ''}?`}
        size="sm"
        fullScreenOnMobile={false}
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowBulkDeleteConfirm(false)} disabled={isBulkDeleting}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleBulkDelete} isLoading={isBulkDeleting} disabled={isBulkDeleting}>
              {isBulkDeleting ? 'Deleting...' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            This action cannot be undone. All selected saved line items will be permanently removed.
          </p>
        </div>
      </AppModal>
    </div>
  )
}
