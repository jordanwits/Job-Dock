import { useState, useRef, useCallback } from 'react'
import { Modal, Button, Card } from '@/components/ui'
import { contactsService } from '@/lib/api/services'
import type { CSVPreview, ImportSessionData, ImportConflict } from '../types/import'

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
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Import Contacts from CSV"
      size="xl"
    >
      <div className="space-y-6">
        {error && (
          <Card className="bg-red-500/10 border-red-500 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </Card>
        )}

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="text-center p-8 border-2 border-dashed border-primary-light/30 rounded-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Choose CSV File'}
              </Button>
              <p className="text-sm text-primary-light/70 mt-2">
                Maximum file size: 10MB
              </p>
            </div>
            <div className="text-sm text-primary-light/70 space-y-2">
              <p className="font-medium">CSV Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>First row should contain column headers</li>
                <li>Must include firstName and lastName columns</li>
                <li>Email column recommended for duplicate detection</li>
                <li>Common headers will be auto-mapped to contact fields</li>
              </ul>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Preview</h3>
              <p className="text-sm text-primary-light/70">
                Total rows: {preview.totalRows}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-primary-light/20">
                    {preview.headers.map((header) => (
                      <th
                        key={header}
                        className="p-2 text-left font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-primary-light/10">
                      {preview.headers.map((header) => (
                        <td key={header} className="p-2">
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-primary-dark/50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Field Mapping</p>
              <div className="grid grid-cols-2 gap-4">
                {preview.headers.map((header) => (
                  <div key={header} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{header}</span>
                    <span className="text-primary-light/50">→</span>
                    <select
                      value={fieldMapping[header] || ''}
                      onChange={(e) => updateFieldMapping(header, e.target.value)}
                      className="bg-primary-dark border border-primary-light/20 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Skip</option>
                      {contactFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirmMapping} disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Start Import'}
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && importData && (
          <div className="space-y-4 text-center py-8">
            <div className="animate-pulse">
              <div className="w-16 h-16 border-4 border-primary-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
            <p className="text-lg font-medium">Processing CSV Import...</p>
            <div className="text-sm text-primary-light/70">
              <p>
                {importData.progress.processed} of {importData.progress.total} rows processed
              </p>
            </div>
          </div>
        )}

        {/* Conflicts Step */}
        {step === 'conflicts' && currentConflict && importData && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h3 className="text-lg font-medium text-yellow-500 mb-2">
                Duplicate Contact Found
              </h3>
              <p className="text-sm text-primary-light/70">
                {importData.pendingConflicts.length} conflict(s) remaining
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Existing Contact */}
              <Card className="p-4">
                <h4 className="font-medium mb-3 text-primary-gold">Existing Contact</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-primary-light/70">Name:</span>{' '}
                    <span className="font-medium">
                      {currentConflict.existingContact.firstName}{' '}
                      {currentConflict.existingContact.lastName}
                    </span>
                  </div>
                  {currentConflict.existingContact.email && (
                    <div>
                      <span className="text-primary-light/70">Email:</span>{' '}
                      <span>{currentConflict.existingContact.email}</span>
                    </div>
                  )}
                  {currentConflict.existingContact.phone && (
                    <div>
                      <span className="text-primary-light/70">Phone:</span>{' '}
                      <span>{currentConflict.existingContact.phone}</span>
                    </div>
                  )}
                  {currentConflict.existingContact.company && (
                    <div>
                      <span className="text-primary-light/70">Company:</span>{' '}
                      <span>{currentConflict.existingContact.company}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Incoming Data */}
              <Card className="p-4 border-primary-gold">
                <h4 className="font-medium mb-3 text-primary-gold">CSV Data</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-primary-light/70">Name:</span>{' '}
                    <span className="font-medium">
                      {currentConflict.incomingData.firstName}{' '}
                      {currentConflict.incomingData.lastName}
                    </span>
                  </div>
                  {currentConflict.incomingData.email && (
                    <div>
                      <span className="text-primary-light/70">Email:</span>{' '}
                      <span>{currentConflict.incomingData.email}</span>
                    </div>
                  )}
                  {currentConflict.incomingData.phone && (
                    <div>
                      <span className="text-primary-light/70">Phone:</span>{' '}
                      <span>{currentConflict.incomingData.phone}</span>
                    </div>
                  )}
                  {currentConflict.incomingData.company && (
                    <div>
                      <span className="text-primary-light/70">Company:</span>{' '}
                      <span>{currentConflict.incomingData.company}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {importData.pendingConflicts.length > 1 && (
              <div className="flex items-center gap-2 p-3 bg-primary-dark/50 rounded">
                <input
                  type="checkbox"
                  id="apply-to-all"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="w-4 h-4 rounded border-primary-light/20 bg-primary-dark"
                />
                <label htmlFor="apply-to-all" className="text-sm cursor-pointer">
                  Apply this choice to all {importData.pendingConflicts.length} remaining duplicates
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => handleConflictResolution('skip')}
                disabled={isLoading}
              >
                {applyToAll ? 'Skip All' : 'Skip This Contact'}
              </Button>
              <Button
                onClick={() => handleConflictResolution('update')}
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : applyToAll ? 'Update All' : 'Update Existing Contact'}
              </Button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && importData && (
          <div className="space-y-4 text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium">Import Complete!</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <Card className="p-3">
                  <div className="text-2xl font-bold text-green-500">
                    {importData.progress.inserted}
                  </div>
                  <div className="text-xs text-primary-light/70">Inserted</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-blue-500">
                    {importData.progress.updated}
                  </div>
                  <div className="text-xs text-primary-light/70">Updated</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-yellow-500">
                    {importData.progress.skipped}
                  </div>
                  <div className="text-xs text-primary-light/70">Skipped</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-red-500">
                    {importData.progress.failed}
                  </div>
                  <div className="text-xs text-primary-light/70">Failed</div>
                </Card>
              </div>
            </div>

            {importData.errors.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium mb-2">Errors:</p>
                <div className="space-y-1">
                  {importData.errors.map((error, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-left bg-red-500/10 border border-red-500/30 rounded p-2"
                    >
                      Row {error.rowIndex + 1}: {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2 pt-4">
              <Button onClick={handleComplete}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ImportContactsModal
