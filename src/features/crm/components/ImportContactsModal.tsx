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
          <div className="space-y-6">
            <div className="text-center p-12 border-2 border-dashed border-primary-gold/30 rounded-lg bg-gradient-to-br from-primary-dark/50 to-primary-dark/30 hover:border-primary-gold/50 transition-all">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {/* Upload icon */}
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-gold/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-primary-gold mb-2">Upload Your Contacts</h3>
              <p className="text-sm text-primary-light/70 mb-4">
                Import multiple contacts at once from a CSV file
              </p>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-dark/30 border-t-primary-dark rounded-full animate-spin"></div>
                    Loading...
                  </span>
                ) : (
                  'Choose CSV File'
                )}
              </Button>
              
              <p className="text-xs text-primary-light/50 mt-3">
                Maximum file size: 10MB
              </p>
            </div>
            
            {/* Requirements */}
            <div className="bg-primary-dark/50 p-5 rounded-lg border border-primary-light/10">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-sm">ℹ</span>
                </div>
                <div>
                  <p className="font-medium text-primary-light mb-2">Your CSV file should include:</p>
                  <ul className="space-y-2 text-sm text-primary-light/70">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>Column headers</strong> in the first row (like "First Name", "Email", etc.)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>First Name and Last Name</strong> for each contact (required)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">○</span>
                      <span><strong>Email address</strong> (recommended for duplicate detection)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">○</span>
                      <span>Optional fields: Phone, Company, Job Title, Address, City, State, Zip Code, Country</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Header with count */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-primary-gold">Step 1: Preview Your Data</h3>
                <p className="text-xs text-primary-light/60 mt-1">Review the first few contacts from your file</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-gold">{preview.totalRows}</p>
                <p className="text-xs text-primary-light/70">contacts found</p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto border border-primary-light/20 rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary-dark/50 border-b border-primary-light/20">
                    {preview.headers.slice(0, 6).map((header) => (
                      <th
                        key={header}
                        className="p-3 text-left font-medium text-primary-gold"
                      >
                        {header}
                      </th>
                    ))}
                    {preview.headers.length > 6 && (
                      <th className="p-3 text-left font-medium text-primary-light/50">
                        +{preview.headers.length - 6} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 3).map((row, idx) => (
                    <tr key={idx} className="border-b border-primary-light/10 hover:bg-primary-dark/30">
                      {preview.headers.slice(0, 6).map((header) => (
                        <td key={header} className="p-3 text-primary-light/90">
                          {row[header] || <span className="text-primary-light/40">—</span>}
                        </td>
                      ))}
                      {preview.headers.length > 6 && (
                        <td className="p-3 text-primary-light/40">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Field Mapping Summary/Section */}
            <div className="bg-gradient-to-br from-primary-dark/50 to-primary-dark/30 p-6 rounded-lg border border-primary-light/10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-primary-gold mb-1">Step 2: Field Mapping</h3>
                  <p className="text-xs text-primary-light/60">
                    We've automatically matched your CSV columns. Looks good?
                  </p>
                </div>
                <button
                  onClick={() => setShowFieldMapping(!showFieldMapping)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-dark/50 hover:bg-primary-dark/70 border border-primary-light/20 rounded-lg text-xs font-medium text-primary-light/80 transition-all"
                >
                  {showFieldMapping ? (
                    <>
                      <span>Hide Details</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>Customize Mapping</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Auto-mapped fields preview (always visible) */}
              {!showFieldMapping && (
                <div className="space-y-2">
                  {preview.headers.filter(h => fieldMapping[h]).slice(0, 5).map((header) => {
                    const mappedField = contactFields.find(f => f.value === fieldMapping[header])
                    return (
                      <div key={header} className="flex items-center gap-2 text-sm bg-primary-dark/30 px-3 py-2 rounded">
                        <span className="text-primary-light/70">{header}</span>
                        <span className="text-primary-gold">→</span>
                        <span className="text-green-400 font-medium">{mappedField?.label}</span>
                      </div>
                    )
                  })}
                  {preview.headers.filter(h => fieldMapping[h]).length > 5 && (
                    <p className="text-xs text-primary-light/50 px-3">
                      +{preview.headers.filter(h => fieldMapping[h]).length - 5} more fields mapped
                    </p>
                  )}
                  {preview.headers.filter(h => !fieldMapping[h]).length > 0 && (
                    <p className="text-xs text-yellow-500/70 px-3 mt-2">
                      {preview.headers.filter(h => !fieldMapping[h]).length} column(s) will be skipped
                    </p>
                  )}
                </div>
              )}
              
              {/* Detailed field mapping (collapsible) */}
              {showFieldMapping && (
                <div className="grid gap-3 mt-4">
                  {preview.headers.map((header) => {
                    const mappedField = fieldMapping[header]
                    const isSkipped = !mappedField
                    
                    return (
                      <div 
                        key={header} 
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          isSkipped 
                            ? 'bg-primary-dark/30 opacity-60' 
                            : 'bg-primary-dark/50 border border-primary-gold/20'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-primary-light">
                            {header}
                          </p>
                          {preview.rows[0]?.[header] && (
                            <p className="text-xs text-primary-light/50 mt-0.5">
                              Example: {preview.rows[0][header]}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-primary-gold text-lg">→</span>
                          <select
                            value={mappedField || ''}
                            onChange={(e) => updateFieldMapping(header, e.target.value)}
                            className={`bg-primary-dark border rounded-lg px-3 py-2 text-sm min-w-[160px] transition-all ${
                              isSkipped 
                                ? 'border-primary-light/20 text-primary-light/50' 
                                : 'border-primary-gold/40 text-primary-light font-medium'
                            }`}
                          >
                            <option value="">⊘ Don't Import</option>
                            {contactFields.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Helper text */}
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400">
                  ✓ <strong>Auto-detected:</strong> We've automatically matched common field names. 
                  {!showFieldMapping ? ' Click "Customize Mapping" above to adjust.' : ' First Name and Last Name are required.'}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" onClick={handleCancel} className="text-primary-light/70">
                Cancel Import
              </Button>
              <Button 
                onClick={handleConfirmMapping} 
                disabled={isLoading}
                className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark font-medium px-6"
              >
                {isLoading ? 'Processing...' : `Import ${preview.totalRows} Contacts →`}
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && importData && (
          <div className="space-y-6 text-center py-12">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary-gold/30 border-t-primary-gold rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-primary-gold/20 rounded-full"></div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-medium text-primary-gold mb-2">Importing Your Contacts...</h3>
              <p className="text-sm text-primary-light/70">
                This may take a moment. Please don't close this window.
              </p>
            </div>
            <div className="max-w-md mx-auto">
              <div className="bg-primary-dark/50 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary-gold to-yellow-500 h-full transition-all duration-500"
                  style={{ width: `${(importData.progress.processed / importData.progress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-primary-light/60 mt-2">
                {importData.progress.processed} of {importData.progress.total} contacts processed
              </p>
            </div>
          </div>
        )}

        {/* Conflicts Step */}
        {step === 'conflicts' && currentConflict && importData && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-yellow-500 text-xl">⚠</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-yellow-400 mb-1">
                    We Found a Duplicate Contact
                  </h3>
                  <p className="text-sm text-primary-light/70">
                    This person already exists in your contacts. What would you like to do?
                  </p>
                  {importData.pendingConflicts.length > 1 && (
                    <p className="text-xs text-yellow-500/80 mt-2">
                      {importData.pendingConflicts.length} duplicate(s) found in total
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Current/Existing Contact */}
              <Card className="p-5 bg-primary-dark/50 border-primary-light/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <span className="text-blue-400">👤</span>
                  </div>
                  <h4 className="font-medium text-blue-400">Current Contact</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="pb-2 border-b border-primary-light/10">
                    <p className="text-xs text-primary-light/50 mb-1">Name</p>
                    <p className="font-medium text-primary-light">
                      {currentConflict.existingContact.firstName}{' '}
                      {currentConflict.existingContact.lastName}
                    </p>
                  </div>
                  {currentConflict.existingContact.email && (
                    <div className="pb-2 border-b border-primary-light/10">
                      <p className="text-xs text-primary-light/50 mb-1">Email</p>
                      <p className="text-primary-light">{currentConflict.existingContact.email}</p>
                    </div>
                  )}
                  {currentConflict.existingContact.phone && (
                    <div className="pb-2 border-b border-primary-light/10">
                      <p className="text-xs text-primary-light/50 mb-1">Phone</p>
                      <p className="text-primary-light">{currentConflict.existingContact.phone}</p>
                    </div>
                  )}
                  {currentConflict.existingContact.company && (
                    <div className="pb-2 border-b border-primary-light/10">
                      <p className="text-xs text-primary-light/50 mb-1">Company</p>
                      <p className="text-primary-light">{currentConflict.existingContact.company}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* New/Incoming Data */}
              <Card className="p-5 bg-gradient-to-br from-primary-gold/10 to-primary-gold/5 border-primary-gold/30">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary-gold/20 rounded-full flex items-center justify-center">
                    <span className="text-primary-gold">📄</span>
                  </div>
                  <h4 className="font-medium text-primary-gold">New from CSV</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="pb-2 border-b border-primary-light/10">
                    <p className="text-xs text-primary-light/50 mb-1">Name</p>
                    <p className="font-medium text-primary-light">
                      {currentConflict.incomingData.firstName}{' '}
                      {currentConflict.incomingData.lastName}
                    </p>
                  </div>
                  {currentConflict.incomingData.email && (
                    <div className="pb-2 border-b border-primary-light/10">
                      <p className="text-xs text-primary-light/50 mb-1">Email</p>
                      <p className="text-primary-light">{currentConflict.incomingData.email}</p>
                    </div>
                  )}
                  {currentConflict.incomingData.phone && (
                    <div className="pb-2 border-b border-primary-light/10">
                      <p className="text-xs text-primary-light/50 mb-1">Phone</p>
                      <p className="text-primary-light">{currentConflict.incomingData.phone}</p>
                    </div>
                  )}
                  {currentConflict.incomingData.company && (
                    <div className="pb-2 border-b border-primary-light/10">
                      <p className="text-xs text-primary-light/50 mb-1">Company</p>
                      <p className="text-primary-light">{currentConflict.incomingData.company}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Apply to all option */}
            {importData.pendingConflicts.length > 1 && (
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <input
                  type="checkbox"
                  id="apply-to-all"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="w-4 h-4 rounded border-primary-light/20 bg-primary-dark mt-0.5 cursor-pointer"
                />
                <label htmlFor="apply-to-all" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium text-primary-light">Apply my choice to all duplicates</span>
                  <p className="text-xs text-primary-light/60 mt-1">
                    Use this same action for all {importData.pendingConflicts.length} duplicate contacts found
                  </p>
                </label>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-between items-center gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => handleConflictResolution('skip')}
                disabled={isLoading}
                className="flex-1"
              >
                <span className="flex items-center justify-center gap-2">
                  <span>⊘</span>
                  {applyToAll ? 'Skip All Duplicates' : 'Skip This One'}
                </span>
              </Button>
              <Button
                onClick={() => handleConflictResolution('update')}
                disabled={isLoading}
                className="flex-1 bg-primary-gold hover:bg-primary-gold/90 text-primary-dark font-medium"
              >
                {isLoading ? (
                  'Updating...'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>✓</span>
                    {applyToAll ? 'Update All' : 'Update This Contact'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && importData && (
          <div className="space-y-6 text-center py-8">
            {/* Success Icon */}
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-green-500/30 to-green-600/30 rounded-full flex items-center justify-center border-2 border-green-500/50">
                <svg
                  className="w-10 h-10 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <div>
              <h3 className="text-2xl font-bold text-green-400 mb-2">Import Complete! 🎉</h3>
              <p className="text-sm text-primary-light/70">
                Your contacts have been successfully imported
              </p>
            </div>

            {/* Results Summary */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                  <div className="text-3xl font-bold text-green-400 mb-1">
                    {importData.progress.inserted}
                  </div>
                  <div className="text-xs text-primary-light/70 font-medium">New Contacts</div>
                  <div className="text-xs text-green-500/70 mt-0.5">Added</div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                  <div className="text-3xl font-bold text-blue-400 mb-1">
                    {importData.progress.updated}
                  </div>
                  <div className="text-xs text-primary-light/70 font-medium">Contacts</div>
                  <div className="text-xs text-blue-500/70 mt-0.5">Updated</div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                  <div className="text-3xl font-bold text-yellow-400 mb-1">
                    {importData.progress.skipped}
                  </div>
                  <div className="text-xs text-primary-light/70 font-medium">Contacts</div>
                  <div className="text-xs text-yellow-500/70 mt-0.5">Skipped</div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                  <div className="text-3xl font-bold text-red-400 mb-1">
                    {importData.progress.failed}
                  </div>
                  <div className="text-xs text-primary-light/70 font-medium">Contacts</div>
                  <div className="text-xs text-red-500/70 mt-0.5">Failed</div>
                </Card>
              </div>
            </div>

            {/* Errors Section */}
            {importData.errors.length > 0 && (
              <div className="mt-6 max-w-2xl mx-auto">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-red-400 text-lg">⚠</span>
                    <p className="text-sm font-medium text-red-400">
                      {importData.errors.length} Error(s) Occurred
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {importData.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-left bg-red-500/5 border border-red-500/20 rounded p-3"
                      >
                        <span className="font-medium text-red-400">Row {error.rowIndex + 1}:</span>
                        <span className="text-primary-light/70 ml-2">{error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Success message for no errors */}
            {importData.errors.length === 0 && importData.progress.inserted > 0 && (
              <div className="max-w-md mx-auto bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <p className="text-sm text-green-400">
                  ✓ All contacts were imported successfully with no errors
                </p>
              </div>
            )}

            {/* Done Button */}
            <div className="flex justify-center gap-2 pt-4">
              <Button 
                onClick={handleComplete}
                className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark font-medium px-8"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ImportContactsModal
