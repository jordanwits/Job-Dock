import { Contact } from '../types/contact'
import { useContactStore } from '../store/contactStore'
import { Modal, Button } from '@/components/ui'
import { useState } from 'react'
import ContactForm from './ContactForm'
import { cn } from '@/lib/utils'

interface ContactDetailProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
}

const ContactDetail = ({ contact, isOpen, onClose }: ContactDetailProps) => {
  const { updateContact, deleteContact, isLoading } = useContactStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleUpdate = async (data: any) => {
    try {
      await updateContact({ id: contact.id, ...data })
      setIsEditing(false)
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
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    lead: 'bg-primary-gold/20 text-primary-gold border-primary-gold/30',
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
        title={`${contact.firstName} ${contact.lastName}`}
        size="lg"
        footer={
          <div className="flex justify-between w-full">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600"
            >
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'px-3 py-1 text-sm font-medium rounded border',
                statusColors[contact.status]
              )}
            >
              {contact.status}
            </span>
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
          </div>

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
        <p className="text-primary-light">
          Are you sure you want to delete{' '}
          <strong>
            {contact.firstName} {contact.lastName}
          </strong>
          ? This action cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default ContactDetail

