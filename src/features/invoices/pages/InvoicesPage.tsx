import { useState } from 'react'
import { useInvoiceStore } from '../store/invoiceStore'
import InvoiceList from '../components/InvoiceList'
import InvoiceForm from '../components/InvoiceForm'
import InvoiceDetail from '../components/InvoiceDetail'
import { Button, Modal, Card } from '@/components/ui'

const InvoicesPage = () => {
  const {
    selectedInvoice,
    createInvoice,
    sendInvoice,
    isLoading,
    error,
    setSelectedInvoice,
    clearError,
  } = useInvoiceStore()
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreate = async (data: any) => {
    try {
      await createInvoice(data)
      setShowCreateForm(false)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateAndSend = async (data: any) => {
    try {
      // Create the invoice first
      const newInvoice = await createInvoice(data)
      // Send the invoice
      if (newInvoice) {
        await sendInvoice(newInvoice.id)
      }
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
          <h1 className="text-2xl md:text-3xl font-bold text-primary-gold">Invoices</h1>
          <p className="text-sm md:text-base text-primary-light/70 mt-1">
            Create and manage invoices for your clients
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
          Create Invoice
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
            clearError()
          }}
          isLoading={isLoading}
        />
      </Modal>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}

export default InvoicesPage

