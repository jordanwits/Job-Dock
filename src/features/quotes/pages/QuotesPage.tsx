import { useState, useEffect } from 'react'
import { useQuoteStore } from '../store/quoteStore'
import QuoteList from '../components/QuoteList'
import QuoteForm from '../components/QuoteForm'
import QuoteDetail from '../components/QuoteDetail'
import { Button, Modal, Card } from '@/components/ui'

const QuotesPage = () => {
  const {
    selectedQuote,
    createQuote,
    sendQuote,
    isLoading,
    error,
    setSelectedQuote,
    clearError,
  } = useQuoteStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')

  const handleCreate = async (data: any) => {
    try {
      await createQuote(data)
      setShowCreateForm(false)
      setConfirmationMessage('Quote Saved')
      setShowConfirmation(true)
      setTimeout(() => setShowConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateAndSend = async (data: any) => {
    try {
      // Create the quote first
      const newQuote = await createQuote(data)
      // Send the quote
      if (newQuote) {
        await sendQuote(newQuote.id)
      }
      setShowCreateForm(false)
      setConfirmationMessage('Quote Sent')
      setShowConfirmation(true)
      setTimeout(() => setShowConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

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
          <h1 className="text-2xl md:text-3xl font-bold text-primary-light tracking-tight">
            <span className="text-primary-gold">Quotes</span>
          </h1>
          <p className="text-sm md:text-base text-primary-light/60">
            Create and manage quotes for your projects
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)} 
          className="w-full sm:w-auto"
          title="Keyboard shortcut: Ctrl+N or ⌘N"
        >
          Create Quote
        </Button>
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
            clearError()
          }}
          isLoading={isLoading}
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
          onJobCreateFailed={(error) => {
            // Error is already displayed by the job store
          }}
        />
      )}
    </div>
  )
}

export default QuotesPage

