import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useInvoiceStore } from '../store/invoiceStore'
import InvoiceList from '../components/InvoiceList'
import InvoiceForm from '../components/InvoiceForm'
import InvoiceDetail from '../components/InvoiceDetail'
import { Button, Modal, Card } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { services } from '@/lib/api/services'

const InvoicesPage = () => {
  const { theme } = useTheme()
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className={cn(
            "text-2xl md:text-3xl font-bold tracking-tight",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
            <span className="text-primary-gold">Invoices</span>
          </h1>
          <p className={cn(
            "text-sm md:text-base",
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>
            Create and manage invoices for your clients
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                `/app/line-items?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`
              )
            }
            className="w-full sm:w-auto"
          >
            Line Items
          </Button>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="w-full sm:w-auto"
            title="Keyboard shortcut: Ctrl+N or ⌘N"
          >
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Confirmation Display */}
      {showConfirmation && (
        <Card className="bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-400">✓ {confirmationMessage}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmation(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Invoice List */}
      <InvoiceList onCreateClick={() => setShowCreateForm(true)} />

      {/* Create Invoice Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false)
          clearError()
        }}
        title="Create New Invoice"
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
      </Modal>

      {/* Invoice Detail Modal */}
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
          onJobCreateFailed={error => {
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
