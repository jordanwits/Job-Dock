import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContactStore } from '../store/contactStore'
import ContactList from '../components/ContactList'
import ContactForm from '../components/ContactForm'
import ContactDetail from '../components/ContactDetail'
import ImportContactsModal from '../components/ImportContactsModal'
import { ScheduleJobModal } from '@/features/scheduling'
import {
  Alert,
  AppButton,
  AppModal,
  CheckIcon,
  PlusIcon,
  UploadIcon,
} from '../components/crmUi'

const CRMPage = () => {
  const navigate = useNavigate()
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
        setConfirmationMessage('Contact created successfully')
        setShowConfirmation(true)
        setTimeout(() => setShowConfirmation(false), 3000)
      }
    } catch (error) {
      // Error handled by store
    }
  }

  const handleImportComplete = async () => {
    setShowImportModal(false)
    await fetchContacts()
    setConfirmationMessage('Contacts imported successfully')
    setShowConfirmation(true)
    setTimeout(() => setShowConfirmation(false), 3000)
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
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Contacts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage your contacts, customers, and leads
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <AppButton
            onClick={() => setShowImportModal(true)}
            variant="subtle"
            className="flex-1 sm:flex-initial"
          >
            <UploadIcon className="h-4 w-4" />
            Import CSV
          </AppButton>
          <AppButton
            onClick={() => setShowCreateForm(true)}
            className="flex-1 sm:flex-initial"
            title="Keyboard shortcut: Ctrl+N or ⌘N"
          >
            <PlusIcon className="h-4 w-4" />
            Add contact
          </AppButton>
        </div>
      </div>

      {/* Error display - hidden while the create/edit modal is open (the form shows its own error) */}
      {error && !showCreateForm && !selectedContact && (
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

      {/* Contact list */}
      <ContactList onCreateClick={() => setShowCreateForm(true)} />

      {/* Create contact modal */}
      <AppModal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false)
          clearError()
        }}
        title="Add new contact"
        size="lg"
      >
        <ContactForm
          onSubmit={handleCreate}
          onCancel={() => {
            setShowCreateForm(false)
            clearError()
          }}
          isLoading={isLoading}
          error={error}
        />
      </AppModal>

      {/* Contact detail modal */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          onJobCreated={(message) => {
            setConfirmationMessage(message || 'Job created successfully')
            setShowConfirmation(true)
            setTimeout(() => setShowConfirmation(false), 3000)
          }}
          onJobCreateFailed={() => {
            // Error is already displayed by the job store
          }}
        />
      )}

      {/* Schedule job modal - for newly created contacts */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => {
          setShowScheduleJob(false)
          setNewContactId(null)
          setNewContactName('')
        }}
        defaultContactId={newContactId || undefined}
        defaultTitle={newContactName || undefined}
        sourceContext="contact"
        onSuccess={(createdJob, options) => {
          setShowScheduleJob(false)
          setNewContactId(null)
          setNewContactName('')
          const message =
            options?.notifySent
              ? 'Contact created. Sent via email and SMS'
              : options?.action === 'independent'
                ? 'Contact created and appointment scheduled'
                : options?.action === 'linked'
                  ? 'Contact created and appointment scheduled for linked job'
                  : options?.action === 'new'
                    ? 'Contact created and job scheduled'
                    : 'Contact created and job scheduled successfully'
          setConfirmationMessage(message)
          setShowConfirmation(true)
          setTimeout(() => setShowConfirmation(false), 3000)
          if (createdJob?.id) {
            navigate(`/app/scheduling?tab=calendar&jobId=${encodeURIComponent(createdJob.id)}`)
          }
        }}
      />

      {/* Import contacts modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}

export default CRMPage
