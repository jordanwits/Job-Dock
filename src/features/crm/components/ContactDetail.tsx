import type { Contact, ContactStatus, CreateContactData } from '../types/contact'
import { useContactStore } from '../store/contactStore'
import { Modal, Button, StatusBadgeSelect } from '@/components/ui'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ContactForm from './ContactForm'
import { ScheduleJobModal } from '@/features/scheduling'
import QuoteForm from '@/features/quotes/components/QuoteForm'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import JobForm from '@/features/scheduling/components/JobForm'
import { CreateJobData } from '@/features/scheduling/types/job'
import InvoiceForm from '@/features/invoices/components/InvoiceForm'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { services } from '@/lib/api/services'
import { cn } from '@/lib/utils'

interface ContactDetailProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
  onJobCreated?: () => void
  onJobCreateFailed?: (error: string) => void
}

const ContactDetail = ({
  contact,
  isOpen,
  onClose,
  onJobCreated,
  onJobCreateFailed,
}: ContactDetailProps) => {
  const navigate = useNavigate()
  const { updateContact, deleteContact, isLoading } = useContactStore()
  const { createQuote, sendQuote, isLoading: quoteLoading } = useQuoteStore()
  const { createJob, isLoading: jobLoading, error: jobError, clearError: clearJobError } = useJobStore()
  const { createInvoice, sendInvoice, isLoading: invoiceLoading } = useInvoiceStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [showCreateQuote, setShowCreateQuote] = useState(false)
  const [showCreateJob, setShowCreateJob] = useState(false)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [showContactConfirmation, setShowContactConfirmation] = useState(false)
  const [contactConfirmationMessage, setContactConfirmationMessage] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    customer: 'bg-green-500/20 text-green-400 border-green-500/30',
    lead: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
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
      const newQuote = await createQuote(data)
      setShowCreateQuote(false)
      onClose()
      
      // Resolve the correct quote ID by polling the quotes list API
      // (similar to jobs - the create response ID may not match the detail page ID)
      const expected = {
        contactId: contact.id,
        title: (newQuote as any)?.title ?? data.title,
        quoteNumber: (newQuote as any)?.quoteNumber,
        createdAt: (newQuote as any)?.createdAt as string | undefined,
      }

      const resolveFromList = async (): Promise<string | undefined> => {
        const maxAttempts = 8
        const baseDelayMs = 350
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const list = await services.quotes.getAll()
            const candidates = Array.isArray(list) ? list : []

            // 1) Direct id match
            const directId = candidates.find((q: any) => q?.id === (newQuote as any)?.id)?.id
            if (directId) return directId

            // 2) Match by contactId + quoteNumber (most reliable)
            if (expected.quoteNumber) {
              const byQuoteNumber = candidates.find(
                (q: any) => q?.contactId === expected.contactId && q?.quoteNumber === expected.quoteNumber
              )
              if (byQuoteNumber?.id) return byQuoteNumber.id
            }

            // 3) Match by contactId + title + createdAt
            const createdAtMs = expected.createdAt ? new Date(expected.createdAt).getTime() : NaN
            const strongMatches = candidates.filter((q: any) => {
              if (!q?.id) return false
              const sameContact = q.contactId === expected.contactId
              const sameTitle = (q.title ?? '').trim() === (expected.title ?? '').trim()
              if (!sameContact || !sameTitle) return false
              if (!Number.isFinite(createdAtMs)) return true
              const qCreated = q.createdAt ? new Date(q.createdAt).getTime() : NaN
              if (!Number.isFinite(qCreated)) return true
              return Math.abs(qCreated - createdAtMs) < 2 * 60 * 1000 // within 2 minutes
            })
            if (strongMatches.length > 0) {
              strongMatches.sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)))
        }
        return undefined
      }

      const idToOpen = await resolveFromList()
      if (!idToOpen) {
        navigate('/app/quotes')
        return
      }
      // Quotes open via QuotesPage query param (there is no /app/quotes/:id route)
      navigate(`/app/quotes?open=${encodeURIComponent(idToOpen)}`, { replace: true })
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateAndSendQuote = async (data: any) => {
    try {
      // Create the quote first
      const newQuote = await createQuote(data)
      // Send the quote
      if (newQuote) {
        await sendQuote(newQuote.id)
      }
      setShowCreateQuote(false)
      onClose()
      
      // Resolve the correct quote ID by polling the quotes list API
      const expected = {
        contactId: contact.id,
        title: (newQuote as any)?.title ?? data.title,
        quoteNumber: (newQuote as any)?.quoteNumber,
        createdAt: (newQuote as any)?.createdAt as string | undefined,
      }

      const resolveFromList = async (): Promise<string | undefined> => {
        const maxAttempts = 8
        const baseDelayMs = 350
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const list = await services.quotes.getAll()
            const candidates = Array.isArray(list) ? list : []

            // 1) Direct id match
            const directId = candidates.find((q: any) => q?.id === (newQuote as any)?.id)?.id
            if (directId) return directId

            // 2) Match by contactId + quoteNumber (most reliable)
            if (expected.quoteNumber) {
              const byQuoteNumber = candidates.find(
                (q: any) => q?.contactId === expected.contactId && q?.quoteNumber === expected.quoteNumber
              )
              if (byQuoteNumber?.id) return byQuoteNumber.id
            }

            // 3) Match by contactId + title + createdAt
            const createdAtMs = expected.createdAt ? new Date(expected.createdAt).getTime() : NaN
            const strongMatches = candidates.filter((q: any) => {
              if (!q?.id) return false
              const sameContact = q.contactId === expected.contactId
              const sameTitle = (q.title ?? '').trim() === (expected.title ?? '').trim()
              if (!sameContact || !sameTitle) return false
              if (!Number.isFinite(createdAtMs)) return true
              const qCreated = q.createdAt ? new Date(q.createdAt).getTime() : NaN
              if (!Number.isFinite(qCreated)) return true
              return Math.abs(qCreated - createdAtMs) < 2 * 60 * 1000 // within 2 minutes
            })
            if (strongMatches.length > 0) {
              strongMatches.sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)))
        }
        return undefined
      }

      const idToOpen = await resolveFromList()
      if (!idToOpen) {
        navigate('/app/quotes')
        return
      }
      // Quotes open via QuotesPage query param (there is no /app/quotes/:id route)
      navigate(`/app/quotes?open=${encodeURIComponent(idToOpen)}`, { replace: true })
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateJob = async (data: CreateJobData) => {
    try {
      const jobData = {
        ...data,
        toBeScheduled: true, // Create as unscheduled job
      }
      const newJob = await createJob(jobData)
      clearJobError()
      setShowCreateJob(false)
      onClose()
      if (onJobCreated) {
        onJobCreated()
      }

      // Navigate to Jobs list and auto-open the created job.
      // The POST `/jobs` response id has proven unreliable for `/job-logs/:id`,
      // so we resolve the *real* Jobs-list id by polling `/job-logs` until it appears.
      const expected = {
        contactId: contact.id,
        title: (newJob as any)?.title ?? data.title,
        description: (newJob as any)?.description ?? data.description,
        createdAt: (newJob as any)?.createdAt as string | undefined,
      }

      const resolveFromList = async (): Promise<string | undefined> => {
        const maxAttempts = 8
        const baseDelayMs = 350
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const list = await services.jobLogs.getAll()
            const candidates = Array.isArray(list) ? list : []

            // 1) Direct id match (in case the ids do line up)
            const directId =
              candidates.find((j: any) => j?.id && j.id === (newJob as any)?.id)?.id ??
              candidates.find((j: any) => j?.id && j.id === (newJob as any)?.jobId)?.id ??
              candidates.find((j: any) => j?.id && j.id === (newJob as any)?.job?.id)?.id
            if (directId) return directId

            // 2) Strong match: same contactId + title (+ createdAt close if available)
            const createdAtMs = expected.createdAt ? new Date(expected.createdAt).getTime() : NaN
            const strongMatches = candidates.filter((j: any) => {
              if (!j?.id) return false
              const sameContact = j.contactId === expected.contactId
              const sameTitle = (j.title ?? '').trim() === (expected.title ?? '').trim()
              if (!sameContact || !sameTitle) return false
              if (!Number.isFinite(createdAtMs)) return true
              const jCreated = j.createdAt ? new Date(j.createdAt).getTime() : NaN
              if (!Number.isFinite(jCreated)) return true
              return Math.abs(jCreated - createdAtMs) < 2 * 60 * 1000 // within 2 minutes
            })
            if (strongMatches.length > 0) {
              strongMatches.sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }

            // 3) Fallback: same contactId + title + description
            const fallback = candidates
              .filter((j: any) => {
                const sameContact = j.contactId === expected.contactId
                const sameTitle = (j.title ?? '').trim() === (expected.title ?? '').trim()
                const sameDesc = (j.description ?? '').trim() === (expected.description ?? '').trim()
                return j?.id && sameContact && sameTitle && sameDesc
              })
              .sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0]
            if (fallback?.id) return fallback.id
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)))
        }
        return undefined
      }

      const idToOpen = await resolveFromList()
      if (!idToOpen) {
        navigate('/app/job-logs')
        return
      }
      navigate(`/app/job-logs?openJobId=${encodeURIComponent(idToOpen)}`)
    } catch (error: any) {
      // Error will be displayed in the modal via error prop
      console.error('Error creating job:', error)
    }
  }

  const handleCreateInvoice = async (data: any) => {
    try {
      const newInvoice = await createInvoice(data)
      setShowCreateInvoice(false)
      onClose()
      
      // Resolve the correct invoice ID by polling the invoices list API
      const expected = {
        contactId: contact.id,
        title: (newInvoice as any)?.title ?? data.title,
        invoiceNumber: (newInvoice as any)?.invoiceNumber,
        createdAt: (newInvoice as any)?.createdAt as string | undefined,
      }

      const resolveFromList = async (): Promise<string | undefined> => {
        const maxAttempts = 8
        const baseDelayMs = 350
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const list = await services.invoices.getAll()
            const candidates = Array.isArray(list) ? list : []

            // 1) Direct id match
            const directId = candidates.find((i: any) => i?.id === (newInvoice as any)?.id)?.id
            if (directId) return directId

            // 2) Match by contactId + invoiceNumber (most reliable)
            if (expected.invoiceNumber) {
              const byInvoiceNumber = candidates.find(
                (i: any) => i?.contactId === expected.contactId && i?.invoiceNumber === expected.invoiceNumber
              )
              if (byInvoiceNumber?.id) return byInvoiceNumber.id
            }

            // 3) Match by contactId + title + createdAt
            const createdAtMs = expected.createdAt ? new Date(expected.createdAt).getTime() : NaN
            const strongMatches = candidates.filter((i: any) => {
              if (!i?.id) return false
              const sameContact = i.contactId === expected.contactId
              const sameTitle = (i.title ?? '').trim() === (expected.title ?? '').trim()
              if (!sameContact || !sameTitle) return false
              if (!Number.isFinite(createdAtMs)) return true
              const iCreated = i.createdAt ? new Date(i.createdAt).getTime() : NaN
              if (!Number.isFinite(iCreated)) return true
              return Math.abs(iCreated - createdAtMs) < 2 * 60 * 1000 // within 2 minutes
            })
            if (strongMatches.length > 0) {
              strongMatches.sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)))
        }
        return undefined
      }

      const idToOpen = await resolveFromList()
      if (!idToOpen) {
        navigate('/app/invoices')
        return
      }
      // Invoices open via InvoicesPage query param (there is no /app/invoices/:id route)
      navigate(`/app/invoices?open=${encodeURIComponent(idToOpen)}`, { replace: true })
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCreateAndSendInvoice = async (data: any) => {
    try {
      // Create the invoice first
      const newInvoice = await createInvoice(data)
      // Send the invoice
      if (newInvoice) {
        await sendInvoice(newInvoice.id)
      }
      setShowCreateInvoice(false)
      onClose()
      
      // Resolve the correct invoice ID by polling the invoices list API
      const expected = {
        contactId: contact.id,
        title: (newInvoice as any)?.title ?? data.title,
        invoiceNumber: (newInvoice as any)?.invoiceNumber,
        createdAt: (newInvoice as any)?.createdAt as string | undefined,
      }

      const resolveFromList = async (): Promise<string | undefined> => {
        const maxAttempts = 8
        const baseDelayMs = 350
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const list = await services.invoices.getAll()
            const candidates = Array.isArray(list) ? list : []

            // 1) Direct id match
            const directId = candidates.find((i: any) => i?.id === (newInvoice as any)?.id)?.id
            if (directId) return directId

            // 2) Match by contactId + invoiceNumber (most reliable)
            if (expected.invoiceNumber) {
              const byInvoiceNumber = candidates.find(
                (i: any) => i?.contactId === expected.contactId && i?.invoiceNumber === expected.invoiceNumber
              )
              if (byInvoiceNumber?.id) return byInvoiceNumber.id
            }

            // 3) Match by contactId + title + createdAt
            const createdAtMs = expected.createdAt ? new Date(expected.createdAt).getTime() : NaN
            const strongMatches = candidates.filter((i: any) => {
              if (!i?.id) return false
              const sameContact = i.contactId === expected.contactId
              const sameTitle = (i.title ?? '').trim() === (expected.title ?? '').trim()
              if (!sameContact || !sameTitle) return false
              if (!Number.isFinite(createdAtMs)) return true
              const iCreated = i.createdAt ? new Date(i.createdAt).getTime() : NaN
              if (!Number.isFinite(iCreated)) return true
              return Math.abs(iCreated - createdAtMs) < 2 * 60 * 1000 // within 2 minutes
            })
            if (strongMatches.length > 0) {
              strongMatches.sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)))
        }
        return undefined
      }

      const idToOpen = await resolveFromList()
      if (!idToOpen) {
        navigate('/app/invoices')
        return
      }
      // Invoices open via InvoicesPage query param (there is no /app/invoices/:id route)
      navigate(`/app/invoices?open=${encodeURIComponent(idToOpen)}`, { replace: true })
    } catch (error) {
      // Error handled by store
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

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
          <div className="flex flex-col sm:flex-row justify-between w-full gap-3 overflow-visible">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600 order-3 sm:order-1 relative z-10"
            >
              Delete
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto items-center overflow-visible">
              <div className="relative w-full sm:w-auto overflow-visible" ref={dropdownRef}>
                <Button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="bg-[#435165] hover:bg-[#435165]/90 text-[#e0e0e0] w-full sm:w-10 h-10 p-0 text-2xl sm:text-xl font-semibold"
                >
                  +
                </Button>
                {showDropdown && (
                  <>
                    <div className="absolute z-40 mt-2 w-full sm:min-w-[160px] sm:w-auto left-0 right-0 sm:left-auto sm:right-auto rounded-lg border border-primary-blue bg-primary-dark-secondary shadow-xl">
                      <div className="p-2 space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateQuote(true)
                            setShowDropdown(false)
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-sm rounded-lg transition-colors',
                            'text-center sm:text-left',
                            'bg-[#435165] hover:bg-[#435165]/90 text-[#e0e0e0]'
                          )}
                        >
                          Create Quote
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateInvoice(true)
                            setShowDropdown(false)
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-sm rounded-lg transition-colors',
                            'text-center sm:text-left',
                            'bg-[#435165] hover:bg-[#435165]/90 text-[#e0e0e0]'
                          )}
                        >
                          Create Invoice
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateJob(true)
                            setShowDropdown(false)
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-sm rounded-lg transition-colors',
                            'text-center sm:text-left',
                            'bg-[#435165] hover:bg-[#435165]/90 text-[#e0e0e0]'
                          )}
                        >
                          Create Job
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowScheduleJob(true)
                            setShowDropdown(false)
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-sm rounded-lg transition-colors',
                            'text-center sm:text-left',
                            'bg-[#435165] hover:bg-[#435165]/90 text-[#e0e0e0]'
                          )}
                        >
                          Schedule Job
                        </button>
                      </div>
                    </div>
                    {/* Spacer to push buttons down on mobile */}
                    <div className="h-40 sm:hidden" />
                  </>
                )}
              </div>
              <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto relative z-10">
                Edit
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary-light">
                {contact.firstName} {contact.lastName}
              </h2>
              {contact.company && <p className="text-primary-light/70 mt-1">{contact.company}</p>}
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
                    <a href={`tel:${contact.phone}`} className="text-primary-light">
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
              <h3 className="text-sm font-medium text-primary-light/70 mb-3">Address</h3>
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
              <h3 className="text-sm font-medium text-primary-light/70 mb-3">Notes</h3>
              <p className="text-sm text-primary-light whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-primary-blue text-xs text-primary-light/50">
            <div>Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
            {contact.updatedAt !== contact.createdAt && (
              <div>Updated: {new Date(contact.updatedAt).toLocaleDateString()}</div>
            )}
          </div>

          {/* Confirmation Messages - Positioned at Bottom for Mobile Visibility */}
          {showJobConfirmation && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500">
              <p className="text-sm text-green-500">✓ Job has been created</p>
            </div>
          )}

          {showContactConfirmation && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500">
              <p className="text-sm text-green-500">✓ {contactConfirmationMessage}</p>
            </div>
          )}
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
            will also permanently remove every quote, invoice, and scheduled job linked to this
            contact. This cannot be undone.
          </p>
          <p>
            Please confirm you want to proceed and that you have exported any information you might
            need later.
          </p>
        </div>
      </Modal>

      {/* Schedule Job Modal */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => setShowScheduleJob(false)}
        defaultContactId={contact.id}
        defaultTitle={`${contact.firstName} ${contact.lastName}`}
        sourceContext="contact"
        onSuccess={(createdJob) => {
          setShowScheduleJob(false)
          onClose()
          if (onJobCreated) {
            onJobCreated()
          }
          // Open the newly scheduled appointment on the calendar.
          if (createdJob?.id) {
            navigate(`/app/scheduling?tab=calendar&jobId=${encodeURIComponent(createdJob.id)}`)
          }
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
          onSaveAndSend={handleCreateAndSendQuote}
          onCancel={() => setShowCreateQuote(false)}
          isLoading={quoteLoading}
          defaultContactId={contact.id}
        />
      </Modal>

      {/* Create Job Modal */}
      <Modal
        isOpen={showCreateJob}
        onClose={() => {
          setShowCreateJob(false)
          clearJobError()
        }}
        title="Create Job"
        size="xl"
      >
        <JobForm
          onSubmit={handleCreateJob}
          onCancel={() => {
            setShowCreateJob(false)
            clearJobError()
          }}
          isLoading={jobLoading}
          error={jobError}
          defaultContactId={contact.id}
          isSimpleCreate={true}
        />
      </Modal>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        title="Create Invoice"
        size="xl"
      >
        <InvoiceForm
          onSubmit={handleCreateInvoice}
          onSaveAndSend={handleCreateAndSendInvoice}
          onCancel={() => setShowCreateInvoice(false)}
          isLoading={invoiceLoading}
          defaultContactId={contact.id}
        />
      </Modal>
    </>
  )
}

export default ContactDetail
