import { Invoice, InvoiceStatus, PaymentStatus } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import InvoiceForm from './InvoiceForm'
import { cn, taxRateToPercent } from '@/lib/utils'
import { formatDateOnly } from '@/lib/utils/dateUtils'
import { ScheduleJobModal } from '@/features/scheduling'
import { QuickBooksInvoicePanel } from '@/features/quickbooks'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { getSendValidationError } from '@/lib/utils/sendValidation'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CalendarIcon,
  CheckIcon,
  PencilIcon,
  SendIcon,
  StatusSelect,
  TextField,
} from './invoicesUi'
import { INVOICE_STATUS_OPTIONS, PAYMENT_STATUS } from './invoiceStatus'

interface InvoiceDetailProps {
  invoice: Invoice
  isOpen: boolean
  onClose: () => void
  onJobCreated?: () => void
  onJobCreateFailed?: (error: string) => void
  onInvoiceSent?: (message: string) => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const PAYMENT_STATUS_OPTIONS = (['pending', 'partial', 'paid'] as PaymentStatus[]).map(v => ({
  value: v,
  label: PAYMENT_STATUS[v].label,
  tone: PAYMENT_STATUS[v].tone,
}))

const InvoiceDetail = ({
  invoice,
  isOpen,
  onClose,
  onJobCreated,
  onJobCreateFailed,
  onInvoiceSent,
}: InvoiceDetailProps) => {
  const { updateInvoice, deleteInvoice, sendInvoice, isLoading } = useInvoiceStore()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [lastSentVia, setLastSentVia] = useState<string[] | null>(null)
  const [editingPaidAmount, setEditingPaidAmount] = useState(false)
  const [paidAmountInput, setPaidAmountInput] = useState('')
  const [paidAmountError, setPaidAmountError] = useState<string | null>(null)
  const [isSavingPaidAmount, setIsSavingPaidAmount] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setEditingPaidAmount(false)
      setPaidAmountError(null)
    }
  }, [isOpen])

  useEffect(() => {
    setEditingPaidAmount(false)
    setPaidAmountError(null)
    setPaidAmountInput('')
  }, [invoice.id])

  const openPaidAmountEdit = () => {
    setPaidAmountInput(
      invoice.paidAmount > 0 ? String(invoice.paidAmount) : ''
    )
    setPaidAmountError(null)
    setEditingPaidAmount(true)
  }

  const cancelPaidAmountEdit = () => {
    setEditingPaidAmount(false)
    setPaidAmountError(null)
    setPaidAmountInput(
      invoice.paidAmount > 0 ? String(invoice.paidAmount) : ''
    )
  }

  const savePaidAmount = async () => {
    const raw = paidAmountInput.trim()
    if (raw === '') {
      setPaidAmountError('Enter the amount paid')
      return
    }
    const n = Number(raw)
    if (Number.isNaN(n) || n < 0) {
      setPaidAmountError('Enter a valid amount')
      return
    }
    const total = invoice.total
    if (n >= total) {
      setPaidAmountError(null)
      setIsSavingPaidAmount(true)
      try {
        await updateInvoice({ id: invoice.id, paymentStatus: 'paid' })
        setEditingPaidAmount(false)
      } catch {
        // Store surfaces error
      } finally {
        setIsSavingPaidAmount(false)
      }
      return
    }
    setPaidAmountError(null)
    setIsSavingPaidAmount(true)
    try {
      await updateInvoice({
        id: invoice.id,
        paymentStatus: 'partial',
        paidAmount: n,
      })
      setEditingPaidAmount(false)
    } catch {
      // Store surfaces error
    } finally {
      setIsSavingPaidAmount(false)
    }
  }

  const handleUpdate = async (data: any) => {
    try {
      await updateInvoice({ id: invoice.id, ...data })
      setIsEditing(false)
      setConfirmationMessage('Invoice Updated Successfully')
      setShowConfirmation(true)
      setTimeout(() => setShowConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleDelete = async () => {
    try {
      await deleteInvoice(invoice.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      // Error handled by store
    }
  }

  const handleSend = async () => {
    setSendError(null)
    setSendSuccess(false)
    const validationError = getSendValidationError({
      contactEmail: invoice.contactEmail,
      contactPhone: invoice.contactPhone?.trim(),
      contactNotificationPreference: invoice.contactNotificationPreference || 'both',
    })
    if (validationError) {
      setSendError(validationError)
      setTimeout(() => setSendError(null), 5000)
      return
    }
    setIsSending(true)
    try {
      const updatedInvoice = await sendInvoice(invoice.id)
      const sentVia = updatedInvoice?.sentVia
      setLastSentVia(updatedInvoice?.sentVia ?? [])
      if (sentVia && sentVia.length > 0) {
        const viaText = sentVia.includes('email') && sentVia.includes('sms')
          ? ` via email and SMS to ${updatedInvoice?.contactEmail || updatedInvoice?.contactPhone || 'contact'}`
          : sentVia.includes('sms')
            ? ` via SMS to ${updatedInvoice?.contactPhone || 'contact'}`
            : ` via email to ${updatedInvoice?.contactEmail || 'contact'}`
        onInvoiceSent?.(`Invoice sent successfully${viaText}`)
        onClose()
      } else {
        setSendSuccess(true)
        setTimeout(() => setSendSuccess(false), 3000)
      }
    } catch (error: unknown) {
      setSendError(getErrorMessage(error, 'Failed to send invoice'))
      setTimeout(() => setSendError(null), 5000)
    } finally {
      setIsSending(false)
    }
  }

  // Only show status badge if it's not redundant with paymentStatus
  const shouldShowStatus =
    invoice.status === 'draft' || invoice.status === 'overdue' || invoice.status === 'cancelled'

  const handleInvoiceStatusChange = async (newStatus: string) => {
    try {
      await updateInvoice({ id: invoice.id, status: newStatus as InvoiceStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  const handlePaymentStatusChange = async (newPaymentStatus: string) => {
    try {
      await updateInvoice({ id: invoice.id, paymentStatus: newPaymentStatus as PaymentStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  // Invoice is overdue if due date is more than 1 day in the past
  // (not on the due date itself, but the day after)
  const isOverdue =
    invoice.dueDate &&
    invoice.paymentStatus !== 'paid' &&
    (() => {
      const dueDate = new Date(invoice.dueDate)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      oneDayAgo.setHours(23, 59, 59, 999)
      return dueDate < oneDayAgo
    })()

  if (isEditing) {
    return (
      <AppModal
        isOpen={isOpen}
        onClose={() => {
          setIsEditing(false)
          onClose()
        }}
        title="Edit invoice"
        size="xl"
      >
        <InvoiceForm
          invoice={invoice}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={isLoading}
        />
      </AppModal>
    )
  }

  return (
    <>
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        title={
          invoice.contactName && invoice.title
            ? `${invoice.contactName} — ${invoice.title}`
            : invoice.contactName || invoice.title || invoice.invoiceNumber
        }
        size="lg"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AppButton variant="dangerGhost" onClick={() => setShowDeleteConfirm(true)} className="order-3 sm:order-1">
              Delete
            </AppButton>
            <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:gap-3">
              <AppButton variant="subtle" onClick={() => setShowScheduleJob(true)} fullWidth className="sm:w-auto">
                <CalendarIcon className="h-4 w-4" />
                Schedule job
              </AppButton>
              <AppButton variant="subtle" onClick={() => setIsEditing(true)} fullWidth className="sm:w-auto">
                <PencilIcon className="h-4 w-4" />
                Edit
              </AppButton>
              <AppButton onClick={handleSend} disabled={isSending} isLoading={isSending} fullWidth className="sm:w-auto">
                {!isSending && <SendIcon className="h-4 w-4" />}
                {isSending ? 'Sending...' : invoice.status === 'sent' ? 'Resend invoice' : 'Send invoice'}
              </AppButton>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-mono text-xl font-semibold tabular-nums text-ink">{invoice.invoiceNumber}</h2>
              {invoice.contactName && (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-sm text-ink-muted">
                    {invoice.contactName}
                    {invoice.contactCompany && ` · ${invoice.contactCompany}`}
                  </p>
                  {invoice.contactEmail && <p className="text-[13px] text-ink-subtle">{invoice.contactEmail}</p>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {shouldShowStatus && (
                <StatusSelect
                  value={invoice.status}
                  options={INVOICE_STATUS_OPTIONS}
                  onChange={handleInvoiceStatusChange}
                  isLoading={isLoading}
                />
              )}
              {invoice.trackPayment !== false && (
                <StatusSelect
                  value={invoice.paymentStatus}
                  options={PAYMENT_STATUS_OPTIONS}
                  onChange={handlePaymentStatusChange}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>

          {/* QuickBooks: send this invoice for online payment */}
          <QuickBooksInvoicePanel invoice={invoice} />

          {/* Send error - prominent placement for visibility */}
          {sendError && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {sendError}
            </Alert>
          )}

          {/* Payment info */}
          {invoice.trackPayment !== false && invoice.paymentStatus === 'partial' && (
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
                <span className="text-sm text-ink-muted">Amount paid</span>
                <div className="min-w-0 justify-self-end">
                  {!editingPaidAmount ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={openPaidAmountEdit}
                        disabled={isLoading}
                        className="shrink-0 rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                        title="Set amount paid"
                        aria-label="Set amount paid"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <span className="text-right font-mono text-lg font-semibold tabular-nums text-ink">
                        {formatCurrency(invoice.paidAmount)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2">
                      <div className="relative w-[7.5rem] max-w-full">
                        <span
                          className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center font-mono text-sm font-medium tabular-nums text-ink-subtle"
                          aria-hidden
                        >
                          $
                        </span>
                        <TextField
                          type="number"
                          min={0}
                          step={0.01}
                          value={paidAmountInput}
                          onChange={e => {
                            setPaidAmountInput(e.target.value)
                            setPaidAmountError(null)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void savePaidAmount()
                            if (e.key === 'Escape') cancelPaidAmountEdit()
                          }}
                          className="pl-7 pr-2 text-right font-mono tabular-nums"
                          disabled={isSavingPaidAmount}
                          autoFocus
                          aria-label="Amount paid in dollars"
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <AppButton
                          type="button"
                          size="sm"
                          onClick={() => void savePaidAmount()}
                          disabled={isSavingPaidAmount}
                          isLoading={isSavingPaidAmount}
                        >
                          Save
                        </AppButton>
                        <AppButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={cancelPaidAmountEdit}
                          disabled={isSavingPaidAmount}
                        >
                          Cancel
                        </AppButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {paidAmountError && (
                <p className="mt-2 text-right text-xs text-danger">{paidAmountError}</p>
              )}
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line pt-2">
                <span className="text-sm text-ink-muted">Remaining balance</span>
                <span className="justify-self-end text-right font-mono text-lg font-bold tabular-nums text-ink">
                  {formatCurrency(invoice.total - invoice.paidAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Due date warning */}
          {isOverdue && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              <p className="font-medium">This invoice is overdue</p>
              <p className="mt-1 text-[13px] opacity-80">
                Due date:{' '}
                <span className="font-mono tabular-nums">{formatDateOnly(invoice.dueDate!)}</span>
              </p>
            </Alert>
          )}

          {/* Line items */}
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Line items</h3>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-line sm:block">
              <table className="w-full">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Description</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Qty</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Unit price</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoice.lineItems.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="px-4 py-3 text-sm text-ink">{item.description}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-ink">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-ink">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium tabular-nums text-ink">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {invoice.lineItems.map((item, index) => (
                <div key={item.id || index} className="space-y-2 rounded-xl border border-line bg-surface-2 p-4">
                  <div className="text-sm font-medium text-ink">{item.description}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Quantity</span>
                    <span className="font-mono tabular-nums text-ink">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Unit price</span>
                    <span className="font-mono tabular-nums text-ink">{formatCurrency(item.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-sm font-medium">
                    <span className="text-ink">Total</span>
                    <span className="font-mono tabular-nums text-ink">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal</span>
                <span className="font-mono tabular-nums text-ink">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Tax ({taxRateToPercent(invoice.taxRate)}%)</span>
                <span className="font-mono tabular-nums text-ink">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              {invoice.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Discount</span>
                    <span className="font-mono tabular-nums text-ink">-{formatCurrency(invoice.discount)}</span>
                  </div>
                  {invoice.discountReason && (
                    <p className="text-xs italic text-ink-subtle">{invoice.discountReason}</p>
                  )}
                </>
              )}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="text-base font-semibold text-ink">Total</span>
                <span className="font-mono text-base font-bold tabular-nums text-ink">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment terms and due date */}
          {(invoice.paymentTerms || invoice.dueDate) && (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-2 p-4 md:grid-cols-2">
              {invoice.paymentTerms && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Payment terms</span>
                  <p className="mt-1 text-sm text-ink">{invoice.paymentTerms}</p>
                </div>
              )}
              {invoice.dueDate && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Due date</span>
                  <p className={cn('mt-1 font-mono text-sm tabular-nums', isOverdue ? 'font-medium text-danger' : 'text-ink')}>
                    {formatDateOnly(invoice.dueDate)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t border-line pt-6">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Notes</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{invoice.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-1 border-t border-line pt-4 text-xs text-ink-subtle">
            <div>
              Created <span className="font-mono tabular-nums">{new Date(invoice.createdAt).toLocaleDateString()}</span>
            </div>
            {invoice.updatedAt !== invoice.createdAt && (
              <div>
                Updated <span className="font-mono tabular-nums">{new Date(invoice.updatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Success / status messages — positioned at bottom for mobile visibility */}
          {sendSuccess && lastSentVia && lastSentVia.length > 0 && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>
              Invoice sent successfully
              {lastSentVia.includes('email') && lastSentVia.includes('sms')
                ? ` via email and SMS to ${invoice.contactEmail || invoice.contactPhone || 'contact'}`
                : lastSentVia.includes('sms')
                  ? ` via SMS to ${invoice.contactPhone || 'contact'}`
                  : ` via email to ${invoice.contactEmail || 'contact'}`}
            </Alert>
          )}
          {sendSuccess && (!lastSentVia || lastSentVia.length === 0) && (
            <Alert tone="warning" icon={<AlertIcon className="h-4 w-4" />}>
              Invoice could not be delivered.
              {invoice.contactNotificationPreference === 'sms'
                ? ' SMS delivery failed. Check Twilio configuration.'
                : invoice.contactNotificationPreference === 'email'
                  ? ' Email delivery failed. Check Resend configuration.'
                  : ' Check Twilio and email configuration.'}
            </Alert>
          )}
          {sendError && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {sendError}
            </Alert>
          )}
          {showConfirmation && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>{confirmationMessage}</Alert>
          )}
          {showJobConfirmation && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>Job has been created</Alert>
          )}
        </div>
      </AppModal>

      {/* Schedule Job Modal */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => setShowScheduleJob(false)}
        defaultContactId={invoice.contactId}
        defaultTitle={(() => {
          const title = invoice.title || `Job for invoice ${invoice.invoiceNumber}`
          if (invoice.contactName) {
            const nameParts = invoice.contactName.trim().split(/\s+/)
            const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : invoice.contactName
            return lastName ? `${lastName}-${title}` : title
          }
          return title
        })()}
        defaultPrice={invoice.total}
        sourceContext="invoice"
        invoiceId={invoice.id}
        initialInvoiceId={invoice.id}
        onSuccess={(createdJob) => {
          setShowScheduleJob(false)
          onClose()
          if (onJobCreated) {
            onJobCreated()
          }
          if (createdJob?.id) {
            navigate(`/app/scheduling?tab=calendar&jobId=${encodeURIComponent(createdJob.id)}`)
          }
        }}
      />

      {/* Delete confirmation modal */}
      <AppModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete invoice"
        size="sm"
        fullScreenOnMobile={false}
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
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            Are you sure you want to delete invoice{' '}
            <strong className="font-mono text-ink">{invoice.invoiceNumber}</strong>? This action cannot be undone.
          </p>
        </div>
      </AppModal>
    </>
  )
}

export default InvoiceDetail
