import { format } from 'date-fns'
import { Modal, Button, Card } from '@/components/ui'
import { useJobStore } from '../store/jobStore'
import type { Job } from '../types/job'
import { cn } from '@/lib/utils'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface JobDetailProps {
  job: Job
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onPermanentDelete?: () => void
  onRestore?: () => void
  onConfirm?: () => void
  onDecline?: () => void
  onScheduleFollowup?: () => void
  onScheduleJob?: () => void
}

const JobDetail = ({ job, isOpen, onClose, onEdit, onDelete, onPermanentDelete, onRestore, onConfirm, onDecline, onScheduleFollowup, onScheduleJob }: JobDetailProps) => {
  const navigate = useNavigate()
  const { quotes, fetchQuotes } = useQuoteStore()
  const { invoices, fetchInvoices } = useInvoiceStore()
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)
  
  useEffect(() => {
    if (job?.quoteId && quotes.length === 0) {
      fetchQuotes()
    }
    if (job?.invoiceId && invoices.length === 0) {
      fetchInvoices()
    }
  }, [job, quotes.length, invoices.length, fetchQuotes, fetchInvoices])
  
  const linkedQuote = job.quoteId ? quotes.find(q => q.id === job.quoteId) : null
  const linkedInvoice = job.invoiceId ? invoices.find(i => i.id === job.invoiceId) : null
  
  const statusColors = {
    scheduled: 'border-blue-500 bg-blue-500/10 text-blue-300',
    'in-progress': 'border-yellow-500 bg-yellow-500/10 text-yellow-300',
    completed: 'border-green-500 bg-green-500/10 text-green-300',
    cancelled: 'border-red-500 bg-red-500/10 text-red-300',
    'pending-confirmation': 'border-orange-500 bg-orange-500/10 text-orange-300',
  }

  const statusLabels = {
    scheduled: 'Scheduled',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'pending-confirmation': 'Pending Confirmation',
  }
  
  const isArchived = !!job.archivedAt
  const isUnscheduled = job.toBeScheduled || !job.startTime || !job.endTime
  
  // Detect if this is a multi-day job
  const startTime = job.startTime ? new Date(job.startTime) : null
  const endTime = job.endTime ? new Date(job.endTime) : null
  const durationMs = (startTime && endTime) ? (endTime.getTime() - startTime.getTime()) : 0
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Job Details"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isArchived ? (
              // Archived job actions
              <>
                {onRestore && (
                  <Button onClick={onRestore} className="bg-green-600 hover:bg-green-700 text-white">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Restore
                  </Button>
                )}
                {onPermanentDelete && (
                  <Button variant="ghost" onClick={onPermanentDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Delete Forever
                  </Button>
                )}
              </>
            ) : job.status === 'pending-confirmation' ? (
              // Pending confirmation actions
              <>
                {onDecline && (
                  <Button variant="ghost" onClick={onDecline} className="text-red-500 hover:text-red-600">
                    Decline
                  </Button>
                )}
                {onConfirm && (
                  <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">
                    Confirm Booking
                  </Button>
                )}
              </>
            ) : (
              // Normal job actions - compact with dropdown
              <>
                {(onDelete || onPermanentDelete) && (
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      Delete
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                    {showDeleteMenu && (
                      <>
                        {/* Backdrop to close menu */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowDeleteMenu(false)}
                        />
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-primary-dark/95 backdrop-blur-sm rounded-lg shadow-xl border border-primary-light/20 py-2 z-50">
                          {onDelete && (
                            <button
                              onClick={() => {
                                setShowDeleteMenu(false)
                                onDelete()
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-primary-light hover:bg-primary-light/10 transition-colors flex items-start gap-3 group"
                            >
                              <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-light/70 group-hover:text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4m14 4a2 2 0 100-4m-9 4v12m4-12v12" />
                              </svg>
                              <div>
                                <div className="font-medium text-primary-light">Archive</div>
                                <div className="text-xs text-primary-light/60 mt-0.5">Can be restored later</div>
                              </div>
                            </button>
                          )}
                          {onPermanentDelete && (
                            <>
                              {onDelete && <div className="border-t border-primary-light/10 my-1" />}
                              <button
                                onClick={() => {
                                  setShowDeleteMenu(false)
                                  onPermanentDelete()
                                }}
                                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-start gap-3 group"
                              >
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                  <div className="font-medium">Delete Permanently</div>
                                  <div className="text-xs text-red-400/60 mt-0.5">Cannot be undone</div>
                                </div>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {onEdit && !isArchived && (
                  <Button variant="ghost" onClick={onEdit}>
                    Edit
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isUnscheduled && onScheduleJob && !isArchived && (
              <Button 
                onClick={onScheduleJob}
                className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark"
              >
                Schedule Job
              </Button>
            )}
            {!isUnscheduled && onScheduleFollowup && !isArchived && job.status !== 'pending-confirmation' && (
              <Button 
                onClick={onScheduleFollowup}
                className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark"
              >
                Schedule Follow-up
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary-light mb-2">{job.title}</h2>
            <div className="flex gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-block px-3 py-1 rounded text-sm font-medium',
                  statusColors[job.status]
                )}
              >
                {statusLabels[job.status]}
              </span>
              {isArchived && (
                <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700">
                  📦 Archived {format(new Date(job.archivedAt!), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        {job.description && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Description</h3>
            <p className="text-primary-light">{job.description}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isUnscheduled ? (
            <Card className="sm:col-span-2">
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">Schedule</h3>
              <p className="text-amber-400 text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                To Be Scheduled
              </p>
              <p className="text-sm text-primary-light/50 mt-1">Drag to calendar to schedule</p>
            </Card>
          ) : isMultiDay ? (
            <Card className="sm:col-span-2">
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">Schedule</h3>
              <p className="text-primary-light text-lg">
                {format(startTime!, 'MMM d, yyyy')} – {format(endTime!, 'MMM d, yyyy')}
              </p>
              <p className="text-sm text-primary-light/50 mt-1">All-day job</p>
            </Card>
          ) : (
            <>
              <Card>
                <h3 className="text-sm font-medium text-primary-light/70 mb-2">Start Time</h3>
                <p className="text-primary-light">
                  {format(startTime!, 'MMM d, yyyy h:mm a')}
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-medium text-primary-light/70 mb-2">End Time</h3>
                <p className="text-primary-light">
                  {format(endTime!, 'MMM d, yyyy h:mm a')}
                </p>
              </Card>
            </>
          )}
        </div>

        <Card>
          <h3 className="text-sm font-medium text-primary-light/70 mb-2">Contact</h3>
          <div className="space-y-1">
            {job.contactName ? (
              <>
                <p className="text-primary-light font-medium">{job.contactName}</p>
                {job.contactEmail && (
                  <p className="text-sm text-primary-light/70">{job.contactEmail}</p>
                )}
                {job.contactPhone && (
                  <p className="text-sm text-primary-light/70">{job.contactPhone}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-primary-light/50 italic">Contact information not available</p>
            )}
          </div>
        </Card>

        {job.serviceName && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Service</h3>
            <p className="text-primary-light">{job.serviceName}</p>
          </Card>
        )}

        {/* Linked Quote or Invoice */}
        {(linkedQuote || linkedInvoice) && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Linked Document</h3>
            {linkedQuote && (
              <button
                onClick={() => {
                  onClose()
                  navigate('/quotes')
                }}
                className="text-primary-gold hover:underline text-sm"
              >
                Quote {linkedQuote.quoteNumber}
                {linkedQuote.title && ` — ${linkedQuote.title}`}
              </button>
            )}
            {linkedInvoice && (
              <button
                onClick={() => {
                  onClose()
                  navigate('/invoices')
                }}
                className="text-primary-gold hover:underline text-sm"
              >
                Invoice {linkedInvoice.invoiceNumber}
              </button>
            )}
          </Card>
        )}

        {job.location && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Location</h3>
            <p className="text-primary-light">{job.location}</p>
          </Card>
        )}

        {job.price && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Price</h3>
            <p className="text-primary-light text-lg font-semibold">
              ${job.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </Card>
        )}

        {/* Job Timeline with Breaks */}
        {job.breaks && job.breaks.length > 0 && !isUnscheduled && startTime && endTime && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-3">Job Timeline</h3>
            <div className="space-y-3">
              {(() => {
                // Build timeline segments
                const segments: Array<{ type: 'work' | 'break'; start: Date; end: Date; reason?: string }> = []
                const sortedBreaks = [...job.breaks].sort((a, b) => 
                  new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                )
                
                let currentTime = startTime
                
                sortedBreaks.forEach((breakItem) => {
                  const breakStart = new Date(breakItem.startTime)
                  const breakEnd = new Date(breakItem.endTime)
                  
                  // Add work segment before break
                  if (currentTime < breakStart) {
                    segments.push({ type: 'work', start: currentTime, end: breakStart })
                  }
                  
                  // Add break segment
                  segments.push({ type: 'break', start: breakStart, end: breakEnd, reason: breakItem.reason })
                  
                  currentTime = breakEnd
                })
                
                // Add final work segment if there's time remaining
                if (currentTime < endTime) {
                  segments.push({ type: 'work', start: currentTime, end: endTime })
                }
                
                return segments.map((segment, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      segment.type === 'work' ? 'bg-green-500' : 'bg-orange-500'
                    }`} />
                    <div className="flex-1">
                      {segment.type === 'work' ? (
                        <div>
                          <p className="text-sm text-primary-light font-medium">
                            {index === 0 ? 'Work starts' : 'Work resumes'}
                          </p>
                          <p className="text-xs text-primary-light/70">
                            {isMultiDay 
                              ? `${format(segment.start, 'MMM d, yyyy')} – ${format(segment.end, 'MMM d, yyyy')}`
                              : `${format(segment.start, 'MMM d, h:mm a')} – ${format(segment.end, 'h:mm a')}`
                            }
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-orange-400 font-medium">
                            Paused{segment.reason && `: ${segment.reason}`}
                          </p>
                          <p className="text-xs text-primary-light/70">
                            {isMultiDay
                              ? `${format(segment.start, 'MMM d')} – ${format(segment.end, 'MMM d, yyyy')}`
                              : `${format(segment.start, 'MMM d, h:mm a')} – ${format(segment.end, 'h:mm a')}`
                            }
                          </p>
                          {index === segments.length - 2 && (
                            <p className="text-xs text-green-400 mt-1 font-medium">
                              → Returns {isMultiDay ? format(segment.end, 'MMM d, yyyy') : format(segment.end, 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </Card>
        )}

        {job.notes && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Notes</h3>
            <p className="text-primary-light whitespace-pre-wrap">{job.notes}</p>
          </Card>
        )}
      </div>
    </Modal>
  )
}

export default JobDetail

