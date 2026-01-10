import { useState } from 'react'
import { useContactStore } from '../store/contactStore'
import ContactList from '../components/ContactList'
import ContactForm from '../components/ContactForm'
import ContactDetail from '../components/ContactDetail'
import ImportContactsModal from '../components/ImportContactsModal'
import { Button, Modal, Card } from '@/components/ui'

const CRMPage = () => {
  const {
    selectedContact,
    createContact,
    isLoading,
    error,
    setSelectedContact,
    clearError,
    fetchContacts,
  } = useContactStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const handleCreate = async (data: any) => {
    try {
      await createContact(data)
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
          <h1 className="text-2xl md:text-3xl font-bold text-primary-gold">CRM</h1>
          <p className="text-sm md:text-base text-primary-light/70 mt-1">
            Manage your contacts, customers, and leads
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => setShowImportModal(true)} 
            variant="ghost"
            className="flex-1 sm:flex-initial"
          >
            Import CSV
          </Button>
          <Button 
            onClick={() => setShowCreateForm(true)} 
            className="flex-1 sm:flex-initial"
          >
            Add Contact
          </Button>
        </div>
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

      {/* Contact List */}
      <ContactList onCreateClick={() => setShowCreateForm(true)} />

      {/* Create Contact Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false)
          clearError()
        }}
        title="Add New Contact"
        size="lg"
      >
        <ContactForm
          onSubmit={handleCreate}
          onCancel={() => {
            setShowCreateForm(false)
            clearError()
          }}
          isLoading={isLoading}
        />
      </Modal>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}

      {/* Import Contacts Modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false)
          fetchContacts()
        }}
      />
    </div>
  )
}

export default CRMPage

