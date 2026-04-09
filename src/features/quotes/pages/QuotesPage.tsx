import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuoteStore } from '../store/quoteStore'
import QuoteList from '../components/QuoteList'
import QuoteForm from '../components/QuoteForm'
import QuoteDetail from '../components/QuoteDetail'
import { Button, Modal, Card } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { services } from '@/lib/api/services'

const QuotesPage = () => {
  const { theme } = useTheme()
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className={cn(
            "text-2xl md:text-3xl font-bold tracking-tight",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
            <span className="text-primary-gold">Quotes</span>
          </h1>
          <p className={cn(
            "text-sm md:text-base",
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>
            Create and manage quotes for your projects
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
            Create Quote
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

      {/* Quote List */}
      <QuoteList onCreateClick={() => setShowCreateForm(true)} />

      {/* Create Quote Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false)
          clearError()
        }}
        title="Create New Quote"
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
      </Modal>

      {/* Quote Detail Modal */}
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
          onJobCreateFailed={error => {
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
