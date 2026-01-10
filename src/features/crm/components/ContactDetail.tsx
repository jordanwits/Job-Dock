import type { Contact, ContactStatus, CreateContactData } from '../types/contact'
import { useContactStore } from '../store/contactStore'
import { Modal, Button, StatusBadgeSelect } from '@/components/ui'
import { useState } from 'react'
import ContactForm from './ContactForm'
import { ScheduleJobModal } from '@/features/scheduling'
import QuoteForm from '@/features/quotes/components/QuoteForm'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'

interface ContactDetailProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
}

const ContactDetail = ({ contact, isOpen, onClose }: ContactDetailProps) => {
  const { updateContact, deleteContact, isLoading } = useContactStore()
  const { createQuote, isLoading: quoteLoading } = useQuoteStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [showCreateQuote, setShowCreateQuote] = useState(false)
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [showContactConfirmation, setShowContactConfirmation] = useState(false)
  const [contactConfirmationMessage, setContactConfirmationMessage] = useState('')

  const handleUpdate = async (data: Partial<CreateContactData>) => {
    try {
      await updateContact({ id: contact.id, ...data })
      setIsEditing(false)
      setContactConfirmationMessage('Contact Updated Successfully')
      setShowContactConfirmation(true)
      setTimeout(() => setShowContactConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleDelete = async () => {
    try {
      await deleteContact(contact.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      // Error handled by store
    }
  }

  const statusColors = {
    lead: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    customer: 'bg-green-500/20 text-green-400 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    contact: 'bg-primary-gold/20 text-primary-gold border-primary-gold/30',
  }

  const statusOptions = [
    { value: 'lead', label: 'Lead' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'customer', label: 'Customer' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'contact', label: 'Contact' },
  ]

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateContact({ id: contact.id, status: newStatus as ContactStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateQuote = async (data: any) => {
    try {
      await createQuote(data)
      setShowCreateQuote(false)
      setContactConfirmationMessage('Quote Created Successfully')
      setShowContactConfirmation(true)
      setTimeout(() => setShowContactConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  if (isEditing) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsEditing(false)
          onClose()
        }}
        title="Edit Contact"
        size="lg"
      >
        <ContactForm
          contact={contact}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={isLoading}
        />
      </Modal>
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Contact Details"
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row justify-between w-full gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600 order-3 sm:order-1"
            >
              Delete
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                onClick={() => setShowCreateQuote(true)}
                className="bg-primary-blue hover:bg-primary-blue/90 text-primary-light w-full sm:w-auto"
              >
                Create Quote
              </Button>
              <Button
                onClick={() => setShowScheduleJob(true)}
                className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark w-full sm:w-auto"
              >
                Schedule Job
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto">Edit</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Job Confirmation */}
          {showJobConfirmation && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500">
              <p className="text-sm text-green-500">✓ Job has been created</p>
            </div>
          )}
          
          {/* Contact Confirmation */}
          {showContactConfirmation && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500">
              <p className="text-sm text-green-500">✓ {contactConfirmationMessage}</p>
            </div>
          )}
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary-light">
                {contact.firstName} {contact.lastName}
              </h2>
              {contact.company && (
                <p className="text-primary-light/70 mt-1">{contact.company}</p>
              )}
            </div>
            <StatusBadgeSelect
              value={contact.status}
              options={statusOptions}
              colorClassesByValue={statusColors}
              onChange={handleStatusChange}
              isLoading={isLoading}
              size="md"
            />
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-primary-blue/20 text-primary-blue rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-3">
                Contact Information
              </h3>
              <div className="space-y-2 text-sm">
                {contact.email && (
                  <div>
                    <span className="text-primary-light/70">Email: </span>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-primary-gold hover:underline"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <span className="text-primary-light/70">Phone: </span>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-primary-light"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-3">
                Company Information
              </h3>
              <div className="space-y-2 text-sm">
                {contact.company && (
                  <div>
                    <span className="text-primary-light/70">Company: </span>
                    <span className="text-primary-light">{contact.company}</span>
                  </div>
                )}
                {contact.jobTitle && (
                  <div>
                    <span className="text-primary-light/70">Job Title: </span>
                    <span className="text-primary-light">{contact.jobTitle}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {(contact.address || contact.city || contact.state) && (
            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-3">
                Address
              </h3>
              <div className="text-sm text-primary-light">
                {contact.address && <div>{contact.address}</div>}
                {(contact.city || contact.state || contact.zipCode) && (
                  <div>
                    {contact.city}
                    {contact.city && contact.state && ', '}
                    {contact.state} {contact.zipCode}
                  </div>
                )}
                {contact.country && <div>{contact.country}</div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-3">
                Notes
              </h3>
              <p className="text-sm text-primary-light whitespace-pre-wrap">
                {contact.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-primary-blue text-xs text-primary-light/50">
            <div>Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
            {contact.updatedAt !== contact.createdAt && (
              <div>Updated: {new Date(contact.updatedAt).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Contact"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <div className="text-primary-light space-y-3 text-sm">
          <p>
            Deleting{' '}
            <strong>
              {contact.firstName} {contact.lastName}
            </strong>{' '}
            will also permanently remove every quote, invoice, and scheduled job
            linked to this contact. This cannot be undone.
          </p>
          <p>
            Please confirm you want to proceed and that you have exported any
            information you might need later.
          </p>
        </div>
      </Modal>

      {/* Schedule Job Modal */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => setShowScheduleJob(false)}
        defaultContactId={contact.id}
        defaultTitle={`Job for ${contact.firstName} ${contact.lastName}`}
        sourceContext="contact"
        onSuccess={() => {
          setShowJobConfirmation(true)
          setTimeout(() => setShowJobConfirmation(false), 3000)
        }}
      />

      {/* Create Quote Modal */}
      <Modal
        isOpen={showCreateQuote}
        onClose={() => setShowCreateQuote(false)}
        title="Create Quote"
        size="xl"
      >
        <QuoteForm
          onSubmit={handleCreateQuote}
          onCancel={() => setShowCreateQuote(false)}
          isLoading={quoteLoading}
          defaultContactId={contact.id}
        />
      </Modal>
    </>
  )
}

export default ContactDetail

