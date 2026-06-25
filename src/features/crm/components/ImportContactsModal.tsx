import { useState, useRef } from 'react'
import { contactsService } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import type { CSVPreview, ImportSessionData, ImportConflict } from '../types/import'
import {
  Alert,
  AppButton,
  AppModal,
  AlertIcon,
  CheckIcon,
  CheckboxField,
  ChevronDownIcon,
  InfoIcon,
  SelectField,
  Spinner,
  UploadIcon,
} from './crmUi'

interface ImportContactsModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

type ImportStep = 'upload' | 'preview' | 'mapping' | 'processing' | 'conflicts' | 'complete'

const ImportContactsModal = ({ isOpen, onClose, onImportComplete }: ImportContactsModalProps) => {
  const [step, setStep] = useState<ImportStep>('upload')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [preview, setPreview] = useState<CSVPreview | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string>('')
  const [importData, setImportData] = useState<ImportSessionData | null>(null)
  const [currentConflict, setCurrentConflict] = useState<ImportConflict | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyToAll, setApplyToAll] = useState(false)
  const [showFieldMapping, setShowFieldMapping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
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
  }

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
    reader.onload = async (event) => {
      const content = event.target?.result as string
      setCsvContent(content)

      try {
        setIsLoading(true)

        const previewData = await contactsService.importPreview(content)

        setPreview(previewData)
        setFieldMapping(previewData.suggestedMapping)
        setStep('preview')
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV file')
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

      // Initialize import session
      const { sessionId: newSessionId } = await contactsService.importInit(
        csvFile.name,
        csvContent,
        fieldMapping
      )
      setSessionId(newSessionId)

      // Start processing
      setStep('processing')
      const statusData = await contactsService.importProcess(newSessionId)
      setImportData(statusData)

      // Check if there are conflicts
      if (statusData.pendingConflicts.length > 0) {
        setCurrentConflict(statusData.pendingConflicts[0])
        setStep('conflicts')
      } else {
        setStep('complete')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start import')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConflictResolution = async (resolution: 'update' | 'skip') => {
    if (!currentConflict || !sessionId) return

    try {
      setIsLoading(true)
      setError(null)

      if (applyToAll && importData) {
        // Apply the same resolution to all remaining conflicts
        const allConflicts = importData.pendingConflicts
        for (const conflict of allConflicts) {
          await contactsService.importResolveConflict(
            sessionId,
            conflict.id,
            resolution
          )
        }
        // Get final status
        const finalData = await contactsService.importStatus(sessionId)
        setImportData(finalData)
        setStep('complete')
      } else {
        // Resolve only the current conflict
        const updatedData = await contactsService.importResolveConflict(
          sessionId,
          currentConflict.id,
          resolution
        )
        setImportData(updatedData)

        // Check if there are more conflicts
        const remainingConflicts = updatedData.pendingConflicts
        if (remainingConflicts.length > 0) {
          setCurrentConflict(remainingConflicts[0])
        } else {
          setStep('complete')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resolve conflict')
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

  const updateFieldMapping = (csvHeader: string, contactField: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [csvHeader]: contactField,
    }))
  }

  const contactFields = [
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'company', label: 'Company' },
    { value: 'jobTitle', label: 'Job Title' },
    { value: 'address', label: 'Address' },
    { value: 'city', label: 'City' },
    { value: 'state', label: 'State' },
    { value: 'zipCode', label: 'Zip Code' },
    { value: 'country', label: 'Country' },
    { value: 'notes', label: 'Notes' },
  ]

  return (
    <AppModal isOpen={isOpen} onClose={handleCancel} title="Import contacts from CSV" size="xl">
      <div className="space-y-6">
        {error && <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>{error}</Alert>}

        {/* Upload step */}
        {step === 'upload' && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 p-10 text-center transition-colors hover:border-accent hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <UploadIcon className="h-7 w-7" />
              </span>
              <span className="text-lg font-semibold text-ink">Upload your contacts</span>
              <span className="mt-1 text-sm text-ink-muted">
                Import multiple contacts at once from a CSV file
              </span>
              <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-accent-contrast">
                {isLoading ? (
                  <>
                    <Spinner /> Loading...
                  </>
                ) : (
                  'Choose CSV file'
                )}
              </span>
              <span className="mt-3 text-xs text-ink-subtle">Maximum file size: 10MB</span>
            </button>

            {/* Requirements */}
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
                  <InfoIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="mb-2 font-medium text-ink">Your CSV file should include:</p>
                  <ul className="space-y-2 text-sm text-ink-muted">
                    <li className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span><strong className="font-medium text-ink">Column headers</strong> in the first row (like "First Name", "Email", etc.)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span><strong className="font-medium text-ink">First Name and Last Name</strong> for each contact (required)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-info">○</span>
                      <span><strong className="font-medium text-ink">Email address</strong> (recommended for duplicate detection)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-info">○</span>
                      <span>Optional fields: Phone, Company, Job Title, Address, City, State, Zip Code, Country</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview step */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Header with count */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Preview your data</h3>
                <p className="mt-0.5 text-[13px] text-ink-muted">Review the first few contacts from your file</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-semibold tabular-nums text-accent-strong">{preview.totalRows}</p>
                <p className="text-xs text-ink-subtle">contacts found</p>
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-hidden rounded-xl bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line">
                    <tr>
                      {preview.headers.slice(0, 6).map((header) => (
                        <th key={header} className="p-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                          {header}
                        </th>
                      ))}
                      {preview.headers.length > 6 && (
                        <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                          +{preview.headers.length - 6} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.rows.slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        {preview.headers.slice(0, 6).map((header) => (
                          <td key={header} className="p-3 text-ink">
                            {row[header] || <span className="text-ink-subtle">—</span>}
                          </td>
                        ))}
                        {preview.headers.length > 6 && <td className="p-3 text-ink-subtle">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Field mapping */}
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-ink">Field mapping</h3>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    We've automatically matched your CSV columns. Looks good?
                  </p>
                </div>
                <button
                  onClick={() => setShowFieldMapping(!showFieldMapping)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-inset ring-line transition-colors hover:bg-surface-hover"
                >
                  {showFieldMapping ? 'Hide details' : 'Customize mapping'}
                  <ChevronDownIcon className={cn('h-4 w-4 transition-transform', showFieldMapping && 'rotate-180')} />
                </button>
              </div>

              {/* Auto-mapped preview */}
              {!showFieldMapping && (
                <div className="space-y-2">
                  {preview.headers.filter(h => fieldMapping[h]).slice(0, 5).map((header) => {
                    const mappedField = contactFields.find(f => f.value === fieldMapping[header])
                    return (
                      <div key={header} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
                        <span className="text-ink-muted">{header}</span>
                        <span className="text-ink-subtle">→</span>
                        <span className="font-medium text-accent-strong">{mappedField?.label}</span>
                      </div>
                    )
                  })}
                  {preview.headers.filter(h => fieldMapping[h]).length > 5 && (
                    <p className="px-3 text-xs text-ink-subtle">
                      +{preview.headers.filter(h => fieldMapping[h]).length - 5} more fields mapped
                    </p>
                  )}
                  {preview.headers.filter(h => !fieldMapping[h]).length > 0 && (
                    <p className="px-3 pt-1 text-xs text-warning">
                      {preview.headers.filter(h => !fieldMapping[h]).length} column(s) will be skipped
                    </p>
                  )}
                </div>
              )}

              {/* Detailed mapping */}
              {showFieldMapping && (
                <div className="mt-2 grid gap-2.5">
                  {preview.headers.map((header) => {
                    const mappedField = fieldMapping[header]
                    const isSkipped = !mappedField
                    return (
                      <div
                        key={header}
                        className={cn(
                          'flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-inset transition-colors',
                          isSkipped ? 'opacity-60 ring-line' : 'ring-accent-soft'
                        )}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-ink">{header}</p>
                          {preview.rows[0]?.[header] && (
                            <p className="mt-0.5 text-xs text-ink-subtle">Example: {preview.rows[0][header]}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-ink-subtle">→</span>
                          <div className="w-[180px] shrink-0">
                            <SelectField
                              aria-label={`Map column ${header}`}
                              value={mappedField || ''}
                              onChange={(e) => updateFieldMapping(header, e.target.value)}
                              options={[{ value: '', label: "Don't import" }, ...contactFields]}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Helper text */}
              <div className="mt-4">
                <Alert tone="info" icon={<InfoIcon className="h-4 w-4" />}>
                  <strong className="font-semibold">Auto-detected:</strong> We've automatically matched common field names.
                  {!showFieldMapping ? ' Click "Customize mapping" above to adjust.' : ' First Name and Last Name are required.'}
                </Alert>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <AppButton variant="ghost" onClick={handleCancel}>Cancel import</AppButton>
              <AppButton onClick={handleConfirmMapping} isLoading={isLoading} disabled={isLoading}>
                {isLoading ? 'Processing...' : `Import ${preview.totalRows} contacts`}
              </AppButton>
            </div>
          </div>
        )}

        {/* Processing step */}
        {step === 'processing' && importData && (
          <div className="space-y-6 py-10 text-center">
            <Spinner className="mx-auto h-12 w-12 text-accent-strong" />
            <div>
              <h3 className="text-lg font-semibold text-ink">Importing your contacts...</h3>
              <p className="mt-1 text-sm text-ink-muted">This may take a moment. Please don't close this window.</p>
            </div>
            <div className="mx-auto max-w-md">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${(importData.progress.processed / importData.progress.total) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                <span className="font-mono tabular-nums">{importData.progress.processed}</span> of{' '}
                <span className="font-mono tabular-nums">{importData.progress.total}</span> contacts processed
              </p>
            </div>
          </div>
        )}

        {/* Conflicts step */}
        {step === 'conflicts' && currentConflict && importData && (
          <div className="space-y-6">
            <Alert tone="warning" icon={<AlertIcon className="h-4 w-4" />}>
              <p className="font-semibold">We found a duplicate contact</p>
              <p className="mt-0.5">This person already exists in your contacts. What would you like to do?</p>
              {importData.pendingConflicts.length > 1 && (
                <p className="mt-1 text-[13px] opacity-80">{importData.pendingConflicts.length} duplicate(s) found in total</p>
              )}
            </Alert>

            {/* Comparison cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <ConflictCard title="Current contact" tone="neutral" data={currentConflict.existingContact} />
              <ConflictCard title="New from CSV" tone="accent" data={currentConflict.incomingData} />
            </div>

            {/* Apply to all */}
            {importData.pendingConflicts.length > 1 && (
              <div className="rounded-xl bg-surface-2 p-4">
                <CheckboxField
                  id="apply-to-all"
                  checked={applyToAll}
                  onChange={setApplyToAll}
                  label="Apply my choice to all duplicates"
                  description={`Use this same action for all ${importData.pendingConflicts.length} duplicate contacts found`}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <AppButton variant="subtle" onClick={() => handleConflictResolution('skip')} disabled={isLoading} fullWidth>
                {applyToAll ? 'Skip all duplicates' : 'Skip this one'}
              </AppButton>
              <AppButton onClick={() => handleConflictResolution('update')} isLoading={isLoading} disabled={isLoading} fullWidth>
                {isLoading ? 'Updating...' : applyToAll ? 'Update all' : 'Update this contact'}
              </AppButton>
            </div>
          </div>
        )}

        {/* Complete step */}
        {step === 'complete' && importData && (
          <div className="space-y-6 py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-ink">Import complete</h3>
              <p className="mt-1 text-sm text-ink-muted">Your contacts have been successfully imported</p>
            </div>

            {/* Summary */}
            <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryTile value={importData.progress.inserted} label="New" tone="success" />
              <SummaryTile value={importData.progress.updated} label="Updated" tone="info" />
              <SummaryTile value={importData.progress.skipped} label="Skipped" tone="warning" />
              <SummaryTile value={importData.progress.failed} label="Failed" tone="danger" />
            </div>

            {/* Errors */}
            {importData.errors.length > 0 && (
              <div className="mx-auto max-w-2xl text-left">
                <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                  <p className="font-semibold">{importData.errors.length} error(s) occurred</p>
                </Alert>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {importData.errors.map((err, idx) => (
                    <div key={idx} className="rounded-lg bg-surface-2 p-3 text-xs">
                      <span className="font-semibold text-danger">Row {err.rowIndex + 1}:</span>
                      <span className="ml-2 text-ink-muted">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importData.errors.length === 0 && importData.progress.inserted > 0 && (
              <div className="mx-auto max-w-md">
                <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>
                  All contacts were imported successfully with no errors
                </Alert>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <AppButton onClick={handleComplete} className="px-8">Done</AppButton>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}

/* Conflict comparison card */
function ConflictCard({
  title,
  tone,
  data,
}: {
  title: string
  tone: 'neutral' | 'accent'
  data: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string }
}) {
  const rows: { label: string; value?: string }[] = [
    { label: 'Name', value: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() },
    { label: 'Email', value: data.email },
    { label: 'Phone', value: data.phone },
    { label: 'Company', value: data.company },
  ]
  return (
    <div
      className={cn(
        'rounded-xl bg-surface p-5 ring-1 ring-inset',
        tone === 'accent' ? 'ring-accent-soft' : 'ring-line'
      )}
    >
      <h4 className={cn('mb-3 text-sm font-semibold', tone === 'accent' ? 'text-accent-strong' : 'text-ink')}>{title}</h4>
      <div className="space-y-3 text-sm">
        {rows.map((row) =>
          row.value ? (
            <div key={row.label} className="border-b border-line pb-2 last:border-0 last:pb-0">
              <p className="mb-0.5 text-[11px] uppercase tracking-wide text-ink-subtle">{row.label}</p>
              <p className="break-words text-ink">{row.value}</p>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

/* Result summary tile */
function SummaryTile({ value, label, tone }: { value: number; label: string; tone: 'success' | 'info' | 'warning' | 'danger' }) {
  const toneCls = {
    success: 'text-success',
    info: 'text-info',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone]
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <div className={cn('font-mono text-2xl font-semibold tabular-nums', toneCls)}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  )
}

export default ImportContactsModal
