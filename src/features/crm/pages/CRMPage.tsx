import { useState, useEffect } from 'react'
import { useContactStore } from '../store/contactStore'
import ContactList from '../components/ContactList'
import ContactForm from '../components/ContactForm'
import ContactDetail from '../components/ContactDetail'
import { ScheduleJobModal } from '@/features/scheduling'
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
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [newContactId, setNewContactId] = useState<string | null>(null)
  const [newContactName, setNewContactName] = useState<string>('')

  const handleCreate = async (data: any, scheduleJob?: boolean) => {
    try {
      const newContact = await createContact(data)
      setShowCreateForm(false)
      
      if (scheduleJob && newContact) {
        // Store the new contact info and open job scheduling modal
        setNewContactId(newContact.id)
        setNewContactName(`${newContact.firstName} ${newContact.lastName}`)
        setShowScheduleJob(true)
      } else {
        setConfirmationMessage('Contact Created Successfully')
        setShowConfirmation(true)
        setTimeout(() => setShowConfirmation(false), 3000)
      }
    } catch (error) {
      // Error handled by store
    }
  }

  // Keyboard shortcut: CMD+N / CTRL+N to create new contact
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault()
        if (!showCreateForm && !selectedContact) {
          setShowCreateForm(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateForm, selectedContact])

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
            onClick={() => setShowCreateForm(true)} 
            className="flex-1 sm:flex-initial"
            title="Keyboard shortcut: Ctrl+N or ⌘N"
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

      {/* Confirmation Display */}
      {showConfirmation && (
        <Card className="bg-green-500/10 border-green-500">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-500">✓ {confirmationMessage}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmation(false)}>
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

      {/* Schedule Job Modal - for newly created contacts */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => {
          setShowScheduleJob(false)
          setNewContactId(null)
          setNewContactName('')
        }}
        defaultContactId={newContactId || undefined}
        defaultTitle={newContactName ? `Job for ${newContactName}` : undefined}
        sourceContext="contact"
        onSuccess={() => {
          setShowScheduleJob(false)
          setNewContactId(null)
          setNewContactName('')
          setConfirmationMessage('Contact created and job scheduled successfully')
          setShowConfirmation(true)
          setTimeout(() => setShowConfirmation(false), 3000)
        }}
      />

    </div>
  )
}

export default CRMPage

