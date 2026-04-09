import { useState, useRef, useCallback } from 'react'
import { Modal, Button, Card } from '@/components/ui'
import { savedLineItemsService } from '@/lib/api/services'
import type { SavedLineItemCSVPreview, SavedLineItemImportSessionData } from '../types/import'
import type { SavedLineItemImportConflict } from '../types/import'

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

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Import saved line items from CSV" size="xl">
      <div className="space-y-6">
        {error && (
          <Card className="bg-red-500/10 border-red-500 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </Card>
        )}

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="text-center p-10 border-2 border-dashed border-primary-gold/30 rounded-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Choose CSV file'}
              </Button>
              <p className="text-xs text-primary-light/50 mt-3">Maximum file size: 10MB</p>
            </div>
            <p className="text-sm text-primary-light/70">
              Include a header row when possible. Typical columns: description, quantity, unit price.
              Unmapped columns are skipped; the first text column is used as the description, and the
              internal name is derived automatically.
            </p>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-primary-gold">Preview</h3>
              <p className="text-sm text-primary-light/70">{preview.totalRows} rows</p>
            </div>
            <div className="overflow-x-auto border border-primary-light/20 rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary-dark/50 border-b border-primary-light/20">
                    {preview.headers.slice(0, 6).map(header => (
                      <th key={header} className="p-3 text-left font-medium text-primary-gold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 3).map((row, idx) => (
                    <tr key={idx} className="border-b border-primary-light/10">
                      {preview.headers.slice(0, 6).map(header => (
                        <td key={header} className="p-3 text-primary-light/90">
                          {row[header] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-primary-gold font-medium">Column mapping</h4>
                <button
                  type="button"
                  onClick={() => setShowFieldMapping(!showFieldMapping)}
                  className="text-xs text-primary-light/70 underline"
                >
                  {showFieldMapping ? 'Hide details' : 'Customize'}
                </button>
              </div>
              {!showFieldMapping ? (
                <ul className="text-sm text-primary-light/80 space-y-1">
                  {preview.headers
                    .filter(h => fieldMapping[h])
                    .slice(0, 8)
                    .map(header => (
                      <li key={header}>
                        <span className="text-primary-light/60">{header}</span>{' '}
                        <span className="text-primary-gold">→</span>{' '}
                        {TARGET_FIELDS.find(f => f.value === fieldMapping[header])?.label ?? fieldMapping[header]}
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {preview.headers.map(header => (
                    <div key={header} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-primary-light flex-1 min-w-[100px]">{header}</span>
                      <select
                        value={fieldMapping[header] || ''}
                        onChange={e => updateFieldMapping(header, e.target.value)}
                        className="bg-primary-dark border border-primary-light/20 rounded px-2 py-1 text-sm text-primary-light min-w-[140px]"
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
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirmMapping} disabled={isLoading} className="bg-primary-gold text-primary-dark">
                {isLoading ? 'Importing…' : `Import ${preview.totalRows} rows`}
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-10 text-primary-light/80">Processing import…</div>
        )}

        {step === 'conflicts' && currentConflict && importData && (
          <div className="space-y-4">
            <Card className="p-4 border-yellow-500/40 bg-yellow-500/5">
              <p className="text-yellow-200 font-medium">
                {currentConflict.type === 'csv_duplicate'
                  ? 'Duplicate row inside this CSV'
                  : 'Already exists in saved line items'}
              </p>
              <p className="text-sm text-primary-light/70 mt-1">
                {currentConflict.type === 'csv_duplicate'
                  ? `Row ${currentConflict.rowIndex + 1} matches row ${(currentConflict.existingRowIndex ?? 0) + 1} in this CSV. You can keep the earlier row, use this row instead, or import both.`
                  : `Row ${currentConflict.rowIndex + 1} matches a saved line item you already have. Update it with CSV values or skip this row.`}
              </p>
            </Card>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <p className="text-xs text-primary-light/50 mb-2">
                  {currentConflict.type === 'csv_duplicate' ? 'Earlier row' : 'Current saved item'}
                </p>
                <p className="font-medium text-primary-light">{currentConflictDescription}</p>
                <p className="text-sm text-primary-light/80 mt-1">
                  Hidden name: {currentConflict.existingItem.name}
                </p>
                <p className="text-sm mt-2">
                  Qty {currentConflict.existingItem.defaultQuantity} ·{' '}
                  {formatMoney(currentConflict.existingItem.unitPrice)}
                </p>
              </Card>
              <Card className="p-4 border-primary-gold/30">
                <p className="text-xs text-primary-light/50 mb-2">From CSV</p>
                <p className="font-medium text-primary-light">{incomingConflictDescription}</p>
                <p className="text-sm text-primary-light/80 mt-1">
                  Hidden name: {currentConflict.incomingData.name ?? '—'}
                </p>
                <p className="text-sm mt-2">
                  Qty {currentConflict.incomingData.defaultQuantity ?? '—'} ·{' '}
                  {formatMoney(currentConflict.incomingData.unitPrice)}
                </p>
              </Card>
            </div>
            {matchingConflictCount > 1 && (
              <label className="flex items-center gap-2 text-sm text-primary-light/80">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={e => setApplyToAll(e.target.checked)}
                />
                Apply the same choice to all {matchingConflictCount} {currentConflict.type === 'csv_duplicate' ? 'CSV duplicates' : 'saved item duplicates'}
              </label>
            )}
            {currentConflict.type === 'csv_duplicate' ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  variant="ghost"
                  onClick={() => handleConflictResolution('keep_existing')}
                  disabled={isLoading}
                >
                  Keep Earlier Row
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleConflictResolution('keep_incoming')}
                  disabled={isLoading}
                >
                  Use This Row
                </Button>
                <Button
                  className="bg-primary-gold text-primary-dark"
                  onClick={() => handleConflictResolution('keep_both')}
                  disabled={isLoading}
                >
                  Import Both
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => handleConflictResolution('skip')}
                  disabled={isLoading}
                >
                  Skip
                </Button>
                <Button
                  className="flex-1 bg-primary-gold text-primary-dark"
                  onClick={() => handleConflictResolution('update')}
                  disabled={isLoading}
                >
                  Update Existing
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'complete' && importData && (
          <div className="space-y-6 text-center py-6">
            <h3 className="text-xl text-green-400 font-medium">Import finished</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <Card className="p-3">
                <div className="text-2xl font-bold text-green-400">{importData.progress.inserted}</div>
                <div className="text-primary-light/60">Added</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold text-blue-400">{importData.progress.updated}</div>
                <div className="text-primary-light/60">Updated</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold text-yellow-400">{importData.progress.skipped}</div>
                <div className="text-primary-light/60">Skipped</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold text-red-400">{importData.progress.failed}</div>
                <div className="text-primary-light/60">Failed</div>
              </Card>
            </div>
            {importData.errors.length > 0 && (
              <div className="text-left max-h-40 overflow-y-auto text-xs text-red-300 space-y-1">
                {importData.errors.map((er, i) => (
                  <div key={i}>
                    Row {er.rowIndex + 1}: {er.message}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleComplete} className="bg-primary-gold text-primary-dark">
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
