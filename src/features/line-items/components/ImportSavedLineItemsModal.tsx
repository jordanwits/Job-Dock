import { useState, useRef, useCallback } from 'react'
import { savedLineItemsService } from '@/lib/api/services'
import type { SavedLineItemCSVPreview, SavedLineItemImportSessionData } from '../types/import'
import type { SavedLineItemImportConflict } from '../types/import'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CheckboxField,
  UploadIcon,
} from '@/features/line-items/components/lineItemsUi'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

type Step = 'upload' | 'preview' | 'mapping' | 'processing' | 'conflicts' | 'complete'

const TARGET_FIELDS = [
  { value: 'description', label: 'Description' },
  { value: 'defaultQuantity', label: 'Default quantity' },
  { value: 'unitPrice', label: 'Unit price' },
] as const

const mappingSelectCls =
  'min-w-[140px] rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]'

export function ImportSavedLineItemsModal({ isOpen, onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [preview, setPreview] = useState<SavedLineItemCSVPreview | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string>('')
  const [importData, setImportData] = useState<SavedLineItemImportSessionData | null>(null)
  const [currentConflict, setCurrentConflict] = useState<SavedLineItemImportConflict | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyToAll, setApplyToAll] = useState(false)
  const [showFieldMapping, setShowFieldMapping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setStep('upload')
    setCsvFile(null)
    setCsvContent('')
    setPreview(null)
    setFieldMapping({})
    setSessionId('')
    setImportData(null)
    setCurrentConflict(null)
    setApplyToAll(false)
    setShowFieldMapping(false)
    setError(null)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }
    setError(null)
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = async event => {
      const content = event.target?.result as string
      setCsvContent(content)
      try {
        setIsLoading(true)
        const previewData = await savedLineItemsService.importPreview(content)
        setPreview(previewData)
        setFieldMapping(previewData.suggestedMapping || {})
        setStep('preview')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse CSV'
        setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg)
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmMapping = async () => {
    if (!csvFile || !csvContent || !preview) return
    try {
      setIsLoading(true)
      setError(null)
      const { sessionId: newSessionId } = await savedLineItemsService.importInit(
        csvFile.name,
        csvContent,
        fieldMapping
      )
      setSessionId(newSessionId)
      setStep('processing')
      const statusData = await savedLineItemsService.importProcess(newSessionId)
      setImportData(statusData)
      if (statusData.pendingConflicts.length > 0) {
        setCurrentConflict(statusData.pendingConflicts[0]!)
        setStep('conflicts')
      } else {
        setStep('complete')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start import'
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConflictResolution = async (
    resolution: 'update' | 'skip' | 'keep_existing' | 'keep_incoming' | 'keep_both'
  ) => {
    if (!currentConflict || !sessionId) return
    try {
      setIsLoading(true)
      setError(null)
      if (applyToAll && importData) {
        const matchingConflicts = importData.pendingConflicts.filter(
          conflict => conflict.type === currentConflict.type
        )
        for (const conflict of matchingConflicts) {
          await savedLineItemsService.importResolveConflict(sessionId, conflict.id, resolution)
        }
        const finalData = await savedLineItemsService.importStatus(sessionId)
        setImportData(finalData)
        const remaining = finalData.pendingConflicts
        if (remaining.length > 0) {
          setCurrentConflict(remaining[0]!)
        } else {
          setStep('complete')
        }
      } else {
        const updatedData = await savedLineItemsService.importResolveConflict(
          sessionId,
          currentConflict.id,
          resolution
        )
        setImportData(updatedData)
        const remaining = updatedData.pendingConflicts
        if (remaining.length > 0) {
          setCurrentConflict(remaining[0]!)
        } else {
          setStep('complete')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve conflict'
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = () => {
    onImportComplete()
    resetState()
    onClose()
  }

  const handleCancel = () => {
    resetState()
    onClose()
  }

  const updateFieldMapping = (csvHeader: string, target: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvHeader]: target,
    }))
  }

  const formatMoney = (n: number | undefined) =>
    n == null || Number.isNaN(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  const currentConflictDescription =
    currentConflict?.existingItem.description || currentConflict?.existingItem.name || '—'
  const incomingConflictDescription =
    currentConflict?.incomingData.description || currentConflict?.incomingData.name || '—'
  const matchingConflictCount = currentConflict && importData
    ? importData.pendingConflicts.filter(conflict => conflict.type === currentConflict.type).length
    : 0

  const sectionHeadingCls = 'text-[11px] font-semibold uppercase tracking-wide text-ink-subtle'

  return (
    <AppModal isOpen={isOpen} onClose={handleCancel} title="Import saved line items from CSV" size="xl">
      <div className="space-y-6">
        {error && (
          <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
            {error}
          </Alert>
        )}

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="rounded-xl border-2 border-dashed border-line-strong p-10 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <UploadIcon className="h-5 w-5" />
              </span>
              <AppButton onClick={() => fileInputRef.current?.click()} disabled={isLoading} isLoading={isLoading}>
                {isLoading ? 'Loading...' : 'Choose CSV file'}
              </AppButton>
              <p className="mt-3 text-xs text-ink-subtle">Maximum file size: 10MB</p>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              Include a header row when possible. Typical columns: description, quantity, unit price.
              Unmapped columns are skipped; the first text column is used as the description, and the
              internal name is derived automatically.
            </p>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">Preview</h3>
              <p className="text-sm text-ink-muted">
                <span className="font-mono tabular-nums text-ink">{preview.totalRows}</span> rows
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    {preview.headers.slice(0, 6).map(header => (
                      <th key={header} className="p-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.rows.slice(0, 3).map((row, idx) => (
                    <tr key={idx}>
                      {preview.headers.slice(0, 6).map(header => (
                        <td key={header} className="p-3 text-ink">
                          {row[header] || <span className="text-ink-subtle">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className={sectionHeadingCls}>Column mapping</h4>
                <button
                  type="button"
                  onClick={() => setShowFieldMapping(!showFieldMapping)}
                  className="text-xs font-medium text-accent-strong transition-opacity hover:opacity-70"
                >
                  {showFieldMapping ? 'Hide details' : 'Customize'}
                </button>
              </div>
              {!showFieldMapping ? (
                <ul className="space-y-1 text-sm text-ink-muted">
                  {preview.headers
                    .filter(h => fieldMapping[h])
                    .slice(0, 8)
                    .map(header => (
                      <li key={header}>
                        <span className="text-ink-subtle">{header}</span>{' '}
                        <span className="text-accent-strong">→</span>{' '}
                        <span className="text-ink">
                          {TARGET_FIELDS.find(f => f.value === fieldMapping[header])?.label ?? fieldMapping[header]}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto">
                  {preview.headers.map(header => (
                    <div key={header} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[100px] flex-1 text-sm text-ink">{header}</span>
                      <select
                        value={fieldMapping[header] || ''}
                        onChange={e => updateFieldMapping(header, e.target.value)}
                        className={mappingSelectCls}
                      >
                        <option value="">Skip</option>
                        {TARGET_FIELDS.map(f => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <AppButton variant="ghost" onClick={handleCancel}>
                Cancel
              </AppButton>
              <AppButton onClick={handleConfirmMapping} disabled={isLoading} isLoading={isLoading}>
                {isLoading ? 'Importing…' : `Import ${preview.totalRows} rows`}
              </AppButton>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-10 text-center text-sm text-ink-muted">Processing import…</div>
        )}

        {step === 'conflicts' && currentConflict && importData && (
          <div className="space-y-4">
            <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
              <p className="font-medium text-warning">
                {currentConflict.type === 'csv_duplicate'
                  ? 'Duplicate row inside this CSV'
                  : 'Already exists in saved line items'}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {currentConflict.type === 'csv_duplicate'
                  ? `Row ${currentConflict.rowIndex + 1} matches row ${(currentConflict.existingRowIndex ?? 0) + 1} in this CSV. You can keep the earlier row, use this row instead, or import both.`
                  : `Row ${currentConflict.rowIndex + 1} matches a saved line item you already have. Update it with CSV values or skip this row.`}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-2 p-4">
                <p className={`mb-2 ${sectionHeadingCls}`}>
                  {currentConflict.type === 'csv_duplicate' ? 'Earlier row' : 'Current saved item'}
                </p>
                <p className="font-medium text-ink">{currentConflictDescription}</p>
                <p className="mt-1 text-sm text-ink-muted">Hidden name: {currentConflict.existingItem.name}</p>
                <p className="mt-2 text-sm text-ink">
                  Qty <span className="font-mono tabular-nums">{currentConflict.existingItem.defaultQuantity}</span> ·{' '}
                  <span className="font-mono tabular-nums">{formatMoney(currentConflict.existingItem.unitPrice)}</span>
                </p>
              </div>
              <div className="rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
                <p className={`mb-2 ${sectionHeadingCls}`}>From CSV</p>
                <p className="font-medium text-ink">{incomingConflictDescription}</p>
                <p className="mt-1 text-sm text-ink-muted">Hidden name: {currentConflict.incomingData.name ?? '—'}</p>
                <p className="mt-2 text-sm text-ink">
                  Qty <span className="font-mono tabular-nums">{currentConflict.incomingData.defaultQuantity ?? '—'}</span> ·{' '}
                  <span className="font-mono tabular-nums">{formatMoney(currentConflict.incomingData.unitPrice)}</span>
                </p>
              </div>
            </div>
            {matchingConflictCount > 1 && (
              <CheckboxField
                checked={applyToAll}
                onChange={setApplyToAll}
                label={`Apply the same choice to all ${matchingConflictCount} ${currentConflict.type === 'csv_duplicate' ? 'CSV duplicates' : 'saved item duplicates'}`}
              />
            )}
            {currentConflict.type === 'csv_duplicate' ? (
              <div className="grid gap-3 md:grid-cols-3">
                <AppButton variant="ghost" onClick={() => handleConflictResolution('keep_existing')} disabled={isLoading}>
                  Keep earlier row
                </AppButton>
                <AppButton variant="subtle" onClick={() => handleConflictResolution('keep_incoming')} disabled={isLoading}>
                  Use this row
                </AppButton>
                <AppButton onClick={() => handleConflictResolution('keep_both')} disabled={isLoading}>
                  Import both
                </AppButton>
              </div>
            ) : (
              <div className="flex gap-3">
                <AppButton variant="ghost" className="flex-1" onClick={() => handleConflictResolution('skip')} disabled={isLoading}>
                  Skip
                </AppButton>
                <AppButton className="flex-1" onClick={() => handleConflictResolution('update')} disabled={isLoading}>
                  Update existing
                </AppButton>
              </div>
            )}
          </div>
        )}

        {step === 'complete' && importData && (
          <div className="space-y-6 py-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <h3 className="text-lg font-semibold text-ink">Import finished</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              {[
                { label: 'Added', value: importData.progress.inserted, cls: 'text-success' },
                { label: 'Updated', value: importData.progress.updated, cls: 'text-info' },
                { label: 'Skipped', value: importData.progress.skipped, cls: 'text-warning' },
                { label: 'Failed', value: importData.progress.failed, cls: 'text-danger' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl border border-line bg-surface-2 p-3">
                  <div className={`font-mono text-2xl font-bold tabular-nums ${stat.cls}`}>{stat.value}</div>
                  <div className="text-ink-subtle">{stat.label}</div>
                </div>
              ))}
            </div>
            {importData.errors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto text-left text-xs text-danger">
                {importData.errors.map((er, i) => (
                  <div key={i}>
                    Row {er.rowIndex + 1}: {er.message}
                  </div>
                ))}
              </div>
            )}
            <AppButton onClick={handleComplete}>Done</AppButton>
          </div>
        )}
      </div>
    </AppModal>
  )
}
