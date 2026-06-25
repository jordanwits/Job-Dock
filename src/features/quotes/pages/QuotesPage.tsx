import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuoteStore } from '../store/quoteStore'
import QuoteList from '../components/QuoteList'
import QuoteForm from '../components/QuoteForm'
import QuoteDetail from '../components/QuoteDetail'
import { Alert, AppButton, AppModal, CheckIcon, DocumentIcon, PlusIcon } from '../components/quotesUi'
import { services } from '@/lib/api/services'

const QuotesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = searchParams.get('returnTo')
  const openCreateQuote = searchParams.get('openCreateQuote') === '1'
  const openQuoteId = searchParams.get('open')
  const [createQuoteDefaults, setCreateQuoteDefaults] = useState<{
    contactId?: string
    title?: string
    notes?: string
    price?: number
  }>({})
  const [linkJobId, setLinkJobId] = useState<string | null>(null)
  const {
    selectedQuote,
    createQuote,
    sendQuote,
    getQuoteById,
    isLoading,
    error,
    setSelectedQuote,
    clearError,
  } = useQuoteStore()
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
      const newQuote = await createQuote(data)
      if (newQuote && linkJobId) {
        await services.jobs.update(linkJobId, { quoteId: newQuote.id })
        setLinkJobId(null)
      }
      setShowCreateForm(false)
      if (returnTo) {
        safeNavigateBack()
      } else {
        setConfirmationMessage('Quote Saved')
        setShowConfirmation(true)
        setTimeout(() => setShowConfirmation(false), 3000)
      }
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateAndSend = async (data: any) => {
    try {
      const newQuote = await createQuote(data)
      if (newQuote && linkJobId) {
        await services.jobs.update(linkJobId, { quoteId: newQuote.id })
        setLinkJobId(null)
      }
      if (newQuote) {
        await sendQuote(newQuote.id)
      }
      setShowCreateForm(false)
      if (returnTo) {
        safeNavigateBack({ quoteSent: '1' })
      } else {
        setConfirmationMessage('Quote Sent')
        setShowConfirmation(true)
        setTimeout(() => setShowConfirmation(false), 3000)
      }
    } catch (error) {
      if (returnTo && returnTo.startsWith('/app')) {
        safeNavigateBack({ quoteFailed: '1' })
      }
      // Error also shown by store
    }
  }

  // Open specific quote when arriving with open=quoteId (e.g. from job detail linked document)
  useEffect(() => {
    if (openQuoteId) {
      getQuoteById(openQuoteId)
      const params = new URLSearchParams(searchParams)
      params.delete('open')
      setSearchParams(params, { replace: true })
    }
  }, [openQuoteId])

  // Open create form when arriving with openCreateQuote=1 (e.g. from job detail)
  useEffect(() => {
    if (openCreateQuote) {
      const jobIdParam = searchParams.get('jobId')
      const priceParam = searchParams.get('price')
      const priceNum = priceParam ? parseFloat(priceParam) : NaN
      setCreateQuoteDefaults({
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
      params.delete('openCreateQuote')
      params.delete('jobId')
      params.delete('contactId')
      params.delete('title')
      params.delete('notes')
      params.delete('price')
      setSearchParams(params, { replace: true })
    }
  }, [openCreateQuote, searchParams, setSearchParams])

  // Keyboard shortcut: CMD+N / CTRL+N to create new quote
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault()
        if (!showCreateForm && !selectedQuote) {
          setShowCreateForm(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateForm, selectedQuote])

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Quotes</h1>
          <p className="mt-1 text-sm text-ink-muted">Create and manage quotes for your projects</p>
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
            Create quote
          </AppButton>
        </div>
      </div>

      {/* Error display - hidden while a modal is open (forms show their own error) */}
      {error && !showCreateForm && !selectedQuote && (
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

      {/* Quote list */}
      <QuoteList onCreateClick={() => setShowCreateForm(true)} />

      {/* Create quote modal */}
      <AppModal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false)
          clearError()
        }}
        title="Create quote"
        size="xl"
      >
        <QuoteForm
          onSubmit={handleCreate}
          onSaveAndSend={handleCreateAndSend}
          onCancel={() => {
            setShowCreateForm(false)
            setCreateQuoteDefaults({})
            setLinkJobId(null)
            clearError()
          }}
          isLoading={isLoading}
          error={error}
          defaultContactId={createQuoteDefaults.contactId}
          defaultTitle={createQuoteDefaults.title}
          defaultNotes={createQuoteDefaults.notes}
          defaultPrice={createQuoteDefaults.price}
        />
      </AppModal>

      {/* Quote detail modal */}
      {selectedQuote && (
        <QuoteDetail
          quote={selectedQuote}
          isOpen={!!selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onJobCreated={() => {
            setConfirmationMessage('Job created successfully')
            setShowConfirmation(true)
            setTimeout(() => setShowConfirmation(false), 3000)
          }}
          onJobCreateFailed={() => {
            // Error is already displayed by the job store
          }}
          onQuoteSent={(message) => {
            setConfirmationMessage(message)
            setShowConfirmation(true)
            setTimeout(() => setShowConfirmation(false), 3000)
          }}
        />
      )}
    </div>
  )
}

export default QuotesPage
