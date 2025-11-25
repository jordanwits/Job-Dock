import { useState } from 'react'
import { useQuoteStore } from '../store/quoteStore'
import QuoteList from '../components/QuoteList'
import QuoteForm from '../components/QuoteForm'
import QuoteDetail from '../components/QuoteDetail'
import { Button, Modal, Card } from '@/components/ui'

const QuotesPage = () => {
  const {
    selectedQuote,
    createQuote,
    isLoading,
    error,
    setSelectedQuote,
    clearError,
  } = useQuoteStore()
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreate = async (data: any) => {
    try {
      await createQuote(data)
      setShowCreateForm(false)
    } catch (error) {
      // Error handled by store
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary-gold">Quotes</h1>
          <p className="text-sm md:text-base text-primary-light/70 mt-1">
            Create and manage quotes for your projects
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
          Create Quote
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-500/10 border-red-500">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Quote List */}
      <QuoteList />

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
        />
      )}
    </div>
  )
}

export default QuotesPage

