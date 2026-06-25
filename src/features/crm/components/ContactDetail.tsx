import type { Contact, ContactStatus, CreateContactData } from '../types/contact'
import { useContactStore } from '../store/contactStore'
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
import { buildContactAddressQuery, cn, getMapsHref } from '@/lib/utils'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { getSendValidationError } from '@/lib/utils/sendValidation'
import {
  Alert,
  AppButton,
  AppModal,
  Avatar,
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PlusIcon,
  StatusSelect,
  TagChip,
  linkCls,
} from './crmUi'
import { CONTACT_STATUS_OPTIONS } from './contactStatus'

interface ContactDetailProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
  onJobCreated?: (message?: string) => void
  onJobCreateFailed?: (error: string) => void
}

const ContactDetail = ({
  contact,
  isOpen,
  onClose,
  onJobCreated,
}: ContactDetailProps) => {
  const navigate = useNavigate()
  const { updateContact, deleteContact, isLoading, error: contactError, clearError: clearContactError } = useContactStore()
  const { createQuote, sendQuote, isLoading: quoteLoading } = useQuoteStore()
  const {
    createJob,
    isLoading: jobLoading,
    error: jobError,
    clearError: clearJobError,
  } = useJobStore()
  const { createInvoice, sendInvoice, isLoading: invoiceLoading } = useInvoiceStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [showCreateQuote, setShowCreateQuote] = useState(false)
  const [showCreateJob, setShowCreateJob] = useState(false)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [showJobConfirmation] = useState(false)
  const [showContactConfirmation, setShowContactConfirmation] = useState(false)
  const [contactConfirmationMessage, setContactConfirmationMessage] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [quoteSendError, setQuoteSendError] = useState<string | null>(null)
  const [invoiceSendError, setInvoiceSendError] = useState<string | null>(null)

  const handleUpdate = async (data: Partial<CreateContactData>) => {
    try {
      await updateContact({ id: contact.id, ...data })
      setIsEditing(false)
      setContactConfirmationMessage('Contact updated successfully')
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
                (q: any) =>
                  q?.contactId === expected.contactId && q?.quoteNumber === expected.quoteNumber
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
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)))
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
    setQuoteSendError(null)
    const validationError = getSendValidationError({
      contactEmail: contact.email,
      contactPhone: contact.phone?.trim(),
      contactNotificationPreference: contact.notificationPreference ?? 'both',
    })
    if (validationError) {
      setQuoteSendError(validationError)
      setTimeout(() => setQuoteSendError(null), 8000)
      return
    }
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
                (q: any) =>
                  q?.contactId === expected.contactId && q?.quoteNumber === expected.quoteNumber
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
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)))
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
      setQuoteSendError(getErrorMessage(error, 'Failed to send quote'))
      setTimeout(() => setQuoteSendError(null), 8000)
    }
  }

  const handleCreateJob = async (
    data: CreateJobData | { title: string; contactId?: string; [key: string]: unknown },
    _existingJobId?: string,
    _isIndependent?: boolean
  ) => {
    try {
      // ContactDetail always creates jobs (not independent); contactId comes from defaultContactId
      const jobData: CreateJobData = {
        ...data,
        contactId: data.contactId ?? contact.id,
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
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }

            // 3) Fallback: same contactId + title + description
            const fallback = candidates
              .filter((j: any) => {
                const sameContact = j.contactId === expected.contactId
                const sameTitle = (j.title ?? '').trim() === (expected.title ?? '').trim()
                const sameDesc =
                  (j.description ?? '').trim() === (expected.description ?? '').trim()
                return j?.id && sameContact && sameTitle && sameDesc
              })
              .sort(
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0]
            if (fallback?.id) return fallback.id
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)))
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
                (i: any) =>
                  i?.contactId === expected.contactId && i?.invoiceNumber === expected.invoiceNumber
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
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)))
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
    setInvoiceSendError(null)
    const validationError = getSendValidationError({
      contactEmail: contact.email,
      contactPhone: contact.phone?.trim(),
      contactNotificationPreference: contact.notificationPreference ?? 'both',
    })
    if (validationError) {
      setInvoiceSendError(validationError)
      setTimeout(() => setInvoiceSendError(null), 8000)
      return
    }
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
                (i: any) =>
                  i?.contactId === expected.contactId && i?.invoiceNumber === expected.invoiceNumber
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
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              return strongMatches[0].id
            }
          } catch {
            // ignore and retry
          }

          // backoff
          await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)))
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
      setInvoiceSendError(getErrorMessage(error, 'Failed to send invoice'))
      setTimeout(() => setInvoiceSendError(null), 8000)
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
      <AppModal
        isOpen={isOpen}
        onClose={() => {
          clearContactError()
          setIsEditing(false)
          onClose()
        }}
        title="Edit contact"
        size="lg"
      >
        <ContactForm
          contact={contact}
          onSubmit={handleUpdate}
          onCancel={() => {
            clearContactError()
            setIsEditing(false)
          }}
          isLoading={isLoading}
          error={contactError}
        />
      </AppModal>
    )
  }

  const hasAddress = contact.address || contact.city || contact.state
  const dropdownActions = [
    { label: 'Create quote', onClick: () => setShowCreateQuote(true) },
    { label: 'Create job', onClick: () => setShowCreateJob(true) },
    { label: 'Create invoice', onClick: () => setShowCreateInvoice(true) },
    { label: 'Schedule appointment', onClick: () => setShowScheduleJob(true) },
  ]

  return (
    <>
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        title="Contact details"
        size="lg"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AppButton
              variant="dangerGhost"
              onClick={() => setShowDeleteConfirm(true)}
              className="order-3 sm:order-1"
            >
              Delete
            </AppButton>
            <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:gap-3">
              <div className="relative" ref={dropdownRef}>
                <AppButton
                  variant="subtle"
                  onClick={() => setShowDropdown(!showDropdown)}
                  fullWidth
                  className="sm:w-auto"
                >
                  <PlusIcon className="h-4 w-4" />
                  New
                  <ChevronDownIcon className={cn('h-4 w-4 transition-transform', showDropdown && 'rotate-180')} />
                </AppButton>
                {showDropdown && (
                  <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line sm:left-auto sm:right-0 sm:w-52">
                    {dropdownActions.map(action => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          action.onClick()
                          setShowDropdown(false)
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <AppButton onClick={() => setIsEditing(true)} fullWidth className="sm:w-auto">
                Edit
              </AppButton>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Identity header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar firstName={contact.firstName} lastName={contact.lastName} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight text-ink">
                  {contact.firstName} {contact.lastName}
                </h2>
                {contact.jobTitle && (
                  <p className="truncate text-sm text-ink-muted">{contact.jobTitle}</p>
                )}
              </div>
            </div>
            <StatusSelect
              value={contact.status}
              options={CONTACT_STATUS_OPTIONS}
              onChange={handleStatusChange}
              isLoading={isLoading}
            />
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map((tag, index) => (
                <TagChip key={index}>{tag}</TagChip>
              ))}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-6 border-t border-line pt-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Contact information
              </h3>
              <dl className="space-y-3 text-sm">
                {contact.email ? (
                  <InfoItem icon={<MailIcon className="h-4 w-4" />}>
                    <a href={`mailto:${contact.email}`} className={linkCls}>{contact.email}</a>
                  </InfoItem>
                ) : null}
                {contact.phone ? (
                  <InfoItem icon={<PhoneIcon className="h-4 w-4" />}>
                    <a href={`tel:${contact.phone}`} className="font-mono tabular-nums text-ink">{contact.phone}</a>
                  </InfoItem>
                ) : null}
                {!contact.email && !contact.phone && (
                  <p className="text-ink-subtle">No contact details</p>
                )}
              </dl>
            </div>

            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Company
              </h3>
              <dl className="space-y-3 text-sm">
                {contact.company ? (
                  <InfoItem icon={<BuildingIcon className="h-4 w-4" />}>
                    <span className="text-ink">{contact.company}</span>
                  </InfoItem>
                ) : null}
                {contact.jobTitle ? (
                  <div className="text-ink-muted">
                    <span className="text-ink-subtle">Title: </span>
                    <span className="text-ink">{contact.jobTitle}</span>
                  </div>
                ) : null}
                {!contact.company && !contact.jobTitle && (
                  <p className="text-ink-subtle">No company details</p>
                )}
              </dl>
            </div>
          </div>

          {/* Address */}
          {hasAddress && (
            <div className="border-t border-line pt-6">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Address
              </h3>
              <a
                href={getMapsHref(buildContactAddressQuery(contact))}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 text-sm"
              >
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                <span className="text-accent-strong transition-opacity group-hover:opacity-70">
                  {contact.address && <span className="block">{contact.address}</span>}
                  {(contact.city || contact.state || contact.zipCode) && (
                    <span className="block">
                      {contact.city}
                      {contact.city && contact.state && ', '}
                      {contact.state} {contact.zipCode}
                    </span>
                  )}
                  {contact.country && <span className="block">{contact.country}</span>}
                </span>
              </a>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="border-t border-line pt-6">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{contact.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t border-line pt-4 text-xs text-ink-subtle">
            <div>
              Created{' '}
              <span className="font-mono tabular-nums">
                {new Date(contact.createdAt).toLocaleDateString()}
              </span>
            </div>
            {contact.updatedAt !== contact.createdAt && (
              <div>
                Updated{' '}
                <span className="font-mono tabular-nums">
                  {new Date(contact.updatedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Confirmation messages */}
          {showJobConfirmation && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>Job has been created</Alert>
          )}
          {showContactConfirmation && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>{contactConfirmationMessage}</Alert>
          )}
        </div>
      </AppModal>

      {/* Delete confirmation modal */}
      <AppModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete contact"
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleDelete} isLoading={isLoading} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
          <p>
            Deleting{' '}
            <strong className="text-ink">
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
      </AppModal>

      {/* Schedule job modal */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => setShowScheduleJob(false)}
        defaultContactId={contact.id}
        defaultTitle={`${contact.firstName} ${contact.lastName}`}
        sourceContext="contact"
        allowLinkExistingJob={true}
        onSuccess={(createdJob, options) => {
          setShowScheduleJob(false)
          onClose()
          if (onJobCreated) {
            const message =
              options?.notifySent
                ? 'Sent via email and SMS'
                : options?.action === 'independent'
                  ? 'Appointment scheduled'
                  : options?.action === 'linked'
                    ? 'Appointment scheduled for linked job'
                    : options?.action === 'new'
                      ? 'Job created and appointment scheduled'
                      : 'Job created successfully'
            onJobCreated(message)
          }
          // Open the newly scheduled appointment on the calendar.
          if (createdJob?.id) {
            navigate(`/app/scheduling?tab=calendar&jobId=${encodeURIComponent(createdJob.id)}`)
          }
        }}
      />

      {/* Create quote modal */}
      <AppModal
        isOpen={showCreateQuote}
        onClose={() => {
          setShowCreateQuote(false)
          setQuoteSendError(null)
        }}
        title="Create quote"
        size="xl"
      >
        <QuoteForm
          onSubmit={handleCreateQuote}
          onSaveAndSend={handleCreateAndSendQuote}
          onCancel={() => {
            setShowCreateQuote(false)
            setQuoteSendError(null)
          }}
          isLoading={quoteLoading}
          defaultContactId={contact.id}
          error={quoteSendError}
        />
      </AppModal>

      {/* Create job modal */}
      <AppModal
        isOpen={showCreateJob}
        onClose={() => {
          setShowCreateJob(false)
          clearJobError()
        }}
        title="Create job"
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
      </AppModal>

      {/* Create invoice modal */}
      <AppModal
        isOpen={showCreateInvoice}
        onClose={() => {
          setShowCreateInvoice(false)
          setInvoiceSendError(null)
        }}
        title="Create invoice"
        size="xl"
      >
        <InvoiceForm
          onSubmit={handleCreateInvoice}
          onSaveAndSend={handleCreateAndSendInvoice}
          onCancel={() => {
            setShowCreateInvoice(false)
            setInvoiceSendError(null)
          }}
          isLoading={invoiceLoading}
          defaultContactId={contact.id}
          error={invoiceSendError}
        />
      </AppModal>
    </>
  )
}

/* Small icon + value row used in the info grid. */
function InfoItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-ink-muted">
      <span className="shrink-0 text-ink-subtle">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

export default ContactDetail
