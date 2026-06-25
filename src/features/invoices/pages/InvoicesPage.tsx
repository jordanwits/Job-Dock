import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useInvoiceStore } from '../store/invoiceStore'
import InvoiceList from '../components/InvoiceList'
import InvoiceForm from '../components/InvoiceForm'
import InvoiceDetail from '../components/InvoiceDetail'
import { Alert, AppButton, AppModal, CheckIcon, DocumentIcon, PlusIcon } from '../components/invoicesUi'
import { services } from '@/lib/api/services'

const InvoicesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = searchParams.get('returnTo')
  const openInvoiceId = searchParams.get('open')
  const openCreateInvoice = searchParams.get('openCreateInvoice') === '1'
  const [createInvoiceDefaults, setCreateInvoiceDefaults] = useState<{
    contactId?: string
    title?: string
    notes?: string
    price?: number
  }>({})
  const [linkJobId, setLinkJobId] = useState<string | null>(null)
  const {
    selectedInvoice,
    createInvoice,
    sendInvoice,
    getInvoiceById,
    isLoading,
    error,
    setSelectedInvoice,
    clearError,
  } = useInvoiceStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')

  const safeNavigateBack = (params?: Record<string, string>) => {
    if (returnTo && returnTo.startsWith('/app')) {
      if (params && Object.keys(params).length > 0) {
        const [path, existingQuery] = returnTo.split('?')
        const sp = new URLSearchParams(existingQuery || '')
        Object.entries(params).forEach(([k, v]) => sp.set(k, v))
        navigate(path + '?' + sp.toString())
      } else {
        navigate(returnTo)
      }
    }
  }

  const handleCreate = async (data: any) => {
    try {
      const newInvoice = await createInvoice(data)
      if (newInvoice && linkJobId) {
        await services.jobs.update(linkJobId, { invoiceId: newInvoice.id })
        setLinkJobId(null)
      }
      setShowCreateForm(false)
      if (returnTo) {
        safeNavigateBack()
      } else {
        setConfirmationMessage('Invoice Saved')
        setShowConfirmation(true)
        setTimeout(() => setShowConfirmation(false), 3000)
      }
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateAndSend = async (data: any) => {
    try {
      // Create the invoice first
      const newInvoice = await createInvoice(data)
      if (newInvoice && linkJobId) {
        await services.jobs.update(linkJobId, { invoiceId: newInvoice.id })
        setLinkJobId(null)
      }
      // Send the invoice
      if (newInvoice) {
        await sendInvoice(newInvoice.id)
      }
      setShowCreateForm(false)
      if (returnTo) {
        safeNavigateBack({ invoiceSent: '1' })
      } else {
        setConfirmationMessage('Invoice Sent')
        setShowConfirmation(true)
        setTimeout(() => setShowConfirmation(false), 3000)
      }
    } catch (error) {
      if (returnTo && returnTo.startsWith('/app')) {
        safeNavigateBack({ invoiceFailed: '1' })
      }
      // Error also shown by store
    }
  }

  // Open specific invoice when arriving with open=invoiceId (e.g. from job detail linked document)
  useEffect(() => {
    if (openInvoiceId) {
      getInvoiceById(openInvoiceId)
      const params = new URLSearchParams(searchParams)
      params.delete('open')
      setSearchParams(params, { replace: true })
    }
  }, [openInvoiceId])

  // Open create form when arriving with openCreateInvoice=1 (e.g. from job detail)
  useEffect(() => {
    if (openCreateInvoice) {
      const jobIdParam = searchParams.get('jobId')
      const priceParam = searchParams.get('price')
      const priceNum = priceParam ? parseFloat(priceParam) : NaN
      setCreateInvoiceDefaults({
        contactId: searchParams.get('contactId') || undefined,
        title: searchParams.get('title')
          ? decodeURIComponent(searchParams.get('title')!)
          : undefined,
        notes: searchParams.get('notes')
          ? decodeURIComponent(searchParams.get('notes')!)
          : undefined,
        price: !isNaN(priceNum) && priceNum > 0 ? priceNum : undefined,
      })
      if (jobIdParam) setLinkJobId(jobIdParam)
      setShowCreateForm(true)
      const params = new URLSearchParams(searchParams)
      params.delete('openCreateInvoice')
      params.delete('jobId')
      params.delete('contactId')
      params.delete('title')
      params.delete('notes')
      params.delete('price')
      setSearchParams(params, { replace: true })
    }
  }, [openCreateInvoice, searchParams, setSearchParams])

  // Keyboard shortcut: CMD+N / CTRL+N to create new invoice
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault()
        if (!showCreateForm && !selectedInvoice) {
          setShowCreateForm(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateForm, selectedInvoice])

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-ink-muted">Create and manage invoices for your clients</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <AppButton
            variant="subtle"
            onClick={() =>
              navigate(
                `/app/line-items?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`
              )
            }
            className="flex-1 sm:flex-initial"
          >
            <DocumentIcon className="h-4 w-4" />
            Line items
          </AppButton>
          <AppButton
            onClick={() => setShowCreateForm(true)}
            className="flex-1 sm:flex-initial"
            title="Keyboard shortcut: Ctrl+N or ⌘N"
          >
            <PlusIcon className="h-4 w-4" />
            Create invoice
          </AppButton>
        </div>
      </div>

      {/* Error display - hidden while a modal is open (forms show their own error) */}
      {error && !showCreateForm && !selectedInvoice && (
        <Alert tone="danger" onDismiss={clearError}>
          {error}
        </Alert>
      )}

      {/* Confirmation display */}
      {showConfirmation && (
        <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />} onDismiss={() => setShowConfirmation(false)}>
          {confirmationMessage}
        </Alert>
      )}

      {/* Invoice list */}
      <InvoiceList onCreateClick={() => setShowCreateForm(true)} />

      {/* Create invoice modal */}
      <AppModal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false)
          clearError()
        }}
        title="Create invoice"
        size="xl"
      >
        <InvoiceForm
          onSubmit={handleCreate}
          onSaveAndSend={handleCreateAndSend}
          onCancel={() => {
            setShowCreateForm(false)
            setCreateInvoiceDefaults({}) // Clear defaults when canceling
            clearError()
          }}
          isLoading={isLoading}
          error={error}
          defaultContactId={createInvoiceDefaults.contactId}
          defaultTitle={createInvoiceDefaults.title}
          defaultNotes={createInvoiceDefaults.notes}
          defaultPrice={createInvoiceDefaults.price}
        />
      </AppModal>

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onJobCreated={() => {
            setConfirmationMessage('Job created successfully')
            setShowConfirmation(true)
            setTimeout(() => setShowConfirmation(false), 3000)
          }}
          onJobCreateFailed={() => {
            // Error is already displayed by the job store
          }}
          onInvoiceSent={(message) => {
            setConfirmationMessage(message)
            setShowConfirmation(true)
            setTimeout(() => setShowConfirmation(false), 3000)
          }}
        />
      )}
    </div>
  )
}

export default InvoicesPage
