import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJobStore } from '../store/jobStore'
import { useServiceStore } from '../store/serviceStore'
import { useAuthStore } from '@/features/auth'
import Calendar from '../components/Calendar'
import JobList from '../components/JobList'
import JobForm from '../components/JobForm'
import JobDetail from '../components/JobDetail'
import ServiceList from '../components/ServiceList'
import ServiceForm from '../components/ServiceForm'
import ServiceDetail from '../components/ServiceDetail'
import ScheduleJobModal from '../components/ScheduleJobModal'
import DeleteRecurringJobModal from '../components/DeleteRecurringJobModal'
import { Button, Modal, Card } from '@/components/ui'
import { format, startOfMonth, endOfMonth, addWeeks } from 'date-fns'

const SchedulingPage = () => {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  
  const {
    jobs,
    selectedJob,
    isLoading: jobsLoading,
    error: jobsError,
    viewMode,
    currentDate,
    createJob,
    updateJob,
    deleteJob,
    confirmJob,
    declineJob,
    setSelectedJob,
    setViewMode,
    setCurrentDate,
    fetchJobs,
    clearError: clearJobsError,
  } = useJobStore()

  const {
    services,
    selectedService,
    isLoading: servicesLoading,
    error: servicesError,
    createService,
    updateService,
    deleteService,
    setSelectedService,
    getBookingLink,
    fetchServices,
    clearError: clearServicesError,
  } = useServiceStore()

  const [showJobForm, setShowJobForm] = useState(false)
  const [editingJob, setEditingJob] = useState<typeof selectedJob>(null)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showServiceDetail, setShowServiceDetail] = useState(false)
  const [bookingLink, setBookingLink] = useState<string>('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  
  // Initialize activeTab from URL query parameter or default to 'calendar'
  const tabParam = searchParams.get('tab')
  const initialTab = (tabParam === 'jobs' || tabParam === 'services' || tabParam === 'calendar') 
    ? tabParam 
    : 'calendar'
  const [activeTab, setActiveTab] = useState<'calendar' | 'jobs' | 'services'>(initialTab as 'calendar' | 'jobs' | 'services')
  
  const [linkCopied, setLinkCopied] = useState(false)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [followupDefaults, setFollowupDefaults] = useState<{
    contactId?: string
    title?: string
    notes?: string
  }>({})
  const [showDeleteRecurringModal, setShowDeleteRecurringModal] = useState(false)
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [showServiceConfirmation, setShowServiceConfirmation] = useState(false)
  const [serviceConfirmationMessage, setServiceConfirmationMessage] = useState('')

  // Set active tab from URL parameter on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'jobs' || tabParam === 'services' || tabParam === 'calendar') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  useEffect(() => {
    // Fetch jobs for current month
    const startDate = startOfMonth(currentDate)
    const endDate = endOfMonth(currentDate)
    fetchJobs(startDate, endDate)
    fetchServices()
  }, [currentDate, fetchJobs, fetchServices])

  const handleCreateJob = async (data: any) => {
    try {
      await createJob(data)
      setShowJobForm(false)
      setShowJobConfirmation(true)
      setTimeout(() => setShowJobConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleUpdateJob = async (data: any) => {
    try {
      if (editingJob) {
        await updateJob({ ...data, id: editingJob.id })
        setEditingJob(null)
        setShowJobForm(false)
        setSelectedJob(null)
        setShowJobConfirmation(true)
        setTimeout(() => setShowJobConfirmation(false), 3000)
      }
    } catch (error) {
      // Error handled by store
    }
  }

  const handleDeleteJob = () => {
    if (selectedJob) {
      // Check if this is a recurring job
      if (selectedJob.recurrenceId) {
        setShowDeleteRecurringModal(true)
      } else {
        // Non-recurring job - delete directly
        handleDeleteSingleJob()
      }
    }
  }

  const handleDeleteSingleJob = async () => {
    if (selectedJob) {
      try {
        console.log('Deleting single job:', selectedJob.id)
        await deleteJob(selectedJob.id, false)
        setSelectedJob(null)
        setShowDeleteRecurringModal(false)
        // Refresh jobs list
        const startDate = startOfMonth(currentDate)
        const endDate = endOfMonth(currentDate)
        await fetchJobs(startDate, endDate)
      } catch (error) {
        console.error('Error deleting single job:', error)
        // Error handled by store
      }
    }
  }

  const handleDeleteAllJobs = async () => {
    if (selectedJob) {
      try {
        console.log('Deleting all jobs with recurrenceId:', selectedJob.recurrenceId)
        await deleteJob(selectedJob.id, true)
        setSelectedJob(null)
        setShowDeleteRecurringModal(false)
        // Refresh jobs list
        const startDate = startOfMonth(currentDate)
        const endDate = endOfMonth(currentDate)
        await fetchJobs(startDate, endDate)
      } catch (error) {
        console.error('Error deleting all jobs:', error)
        // Error handled by store
      }
    }
  }

  const handleCreateService = async (data: any) => {
    try {
      await createService(data)
      setShowServiceForm(false)
      setServiceConfirmationMessage('Service Created Successfully')
      setShowServiceConfirmation(true)
      setTimeout(() => setShowServiceConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleUpdateService = async (data: any) => {
    if (selectedService) {
      try {
        await updateService({ ...data, id: selectedService.id })
        setShowServiceForm(false)
        setSelectedService(null)
        setServiceConfirmationMessage('Service Updated Successfully')
        setShowServiceConfirmation(true)
        setTimeout(() => setShowServiceConfirmation(false), 3000)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleDeleteService = async () => {
    if (selectedService) {
      try {
        await deleteService(selectedService.id)
        setShowServiceDetail(false)
        setSelectedService(null)
        setServiceConfirmationMessage('Service Deleted Successfully')
        setShowServiceConfirmation(true)
        setTimeout(() => setShowServiceConfirmation(false), 3000)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleOpenBookingLink = () => {
    // Open unified tenant booking link directly in a new tab
    const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || ''
    const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const unifiedLink = `${baseUrl}/book?tenant=${tenantId}`
    window.open(unifiedLink, '_blank')
  }

  const handleGetBookingLink = async () => {
    // Show unified tenant booking link instead of individual service link
    // This is used in the service detail modal to show the copy screen
    const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || ''
    const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const unifiedLink = `${baseUrl}/book?tenant=${tenantId}`
    setBookingLink(unifiedLink)
    setShowLinkModal(true)
  }

  const handleConfirmJob = async () => {
    if (selectedJob) {
      try {
        await confirmJob(selectedJob.id)
        setSelectedJob(null)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleDeclineJob = async () => {
    if (selectedJob) {
      try {
        await declineJob(selectedJob.id, declineReason)
        setShowDeclineModal(false)
        setDeclineReason('')
        setSelectedJob(null)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleScheduleFollowup = () => {
    if (selectedJob) {
      setFollowupDefaults({
        contactId: selectedJob.contactId,
        title: `Follow-up: ${selectedJob.title}`,
        notes: `Follow-up job for original job on ${format(new Date(selectedJob.startTime), 'MMM d, yyyy')}`,
      })
      setShowFollowupModal(true)
    }
  }

  const error = jobsError || servicesError

  return (
    <div className="space-y-6 h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary-gold">Scheduling</h1>
          <p className="text-sm md:text-base text-primary-light/70 mt-1">
            Manage your calendar, jobs, and services
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'calendar' && (
            <>
              <Button onClick={() => setShowJobForm(true)} className="w-full sm:w-auto">
                Schedule Job
              </Button>
              <Button onClick={handleOpenBookingLink} variant="secondary" className="w-full sm:w-auto">
                Booking Link
              </Button>
            </>
          )}
          {activeTab === 'services' && (
            <>
              <Button onClick={() => setShowServiceForm(true)} className="w-full sm:w-auto">
                Create Service
              </Button>
              <Button onClick={handleOpenBookingLink} variant="secondary" className="w-full sm:w-auto">
                Booking Link
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-500/10 border-red-500">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-500">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearJobsError()
                clearServicesError()
              }}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Job Confirmation Display */}
      {showJobConfirmation && (
        <Card className="bg-green-500/10 border-green-500">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-500">✓ Job has been created</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJobConfirmation(false)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Service Confirmation Display */}
      {showServiceConfirmation && (
        <Card className="bg-green-500/10 border-green-500">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-500">✓ {serviceConfirmationMessage}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowServiceConfirmation(false)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 md:gap-2 border-b border-primary-blue overflow-x-auto">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`
            px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base
            ${
              activeTab === 'calendar'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/70 hover:text-primary-light'
            }
          `}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`
            px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base
            ${
              activeTab === 'jobs'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/70 hover:text-primary-light'
            }
          `}
        >
          Upcoming Jobs
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`
            px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base
            ${
              activeTab === 'services'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/70 hover:text-primary-light'
            }
          `}
        >
          Services
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-w-0">
        {activeTab === 'calendar' && (
          <div className="h-full min-w-0">
            <Calendar
              jobs={jobs}
              viewMode={viewMode}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onViewModeChange={setViewMode}
              onJobClick={setSelectedJob}
              onDateClick={(date) => {
                setCurrentDate(date)
                setViewMode('day')
              }}
            />
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="h-full overflow-y-auto">
            <JobList />
          </div>
        )}

        {activeTab === 'services' && (
          <div className="h-full overflow-y-auto">
            <ServiceList
              onServiceClick={(id) => {
                const service = services.find((s) => s.id === id)
                if (service) {
                  setSelectedService(service)
                  setShowServiceDetail(true)
                }
              }}
              onCreateClick={() => setShowServiceForm(true)}
            />
          </div>
        )}
      </div>

      {/* Job Form Modal */}
      <Modal
        isOpen={showJobForm}
        onClose={() => {
          setShowJobForm(false)
          setEditingJob(null)
          clearJobsError()
        }}
        title={editingJob ? 'Edit Job' : 'Schedule New Job'}
        size="xl"
      >
        <JobForm
          job={editingJob || undefined}
          onSubmit={editingJob ? handleUpdateJob : handleCreateJob}
          onCancel={() => {
            setShowJobForm(false)
            setEditingJob(null)
            clearJobsError()
          }}
          isLoading={jobsLoading}
        />
      </Modal>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          onEdit={() => {
            setEditingJob(selectedJob)
            setShowJobForm(true)
          }}
          onDelete={handleDeleteJob}
          onConfirm={handleConfirmJob}
          onDecline={() => setShowDeclineModal(true)}
          onScheduleFollowup={handleScheduleFollowup}
        />
      )}

      {/* Follow-up Job Modal */}
      <ScheduleJobModal
        isOpen={showFollowupModal}
        onClose={() => {
          setShowFollowupModal(false)
          setFollowupDefaults({})
        }}
        defaultContactId={followupDefaults.contactId}
        defaultTitle={followupDefaults.title}
        defaultNotes={followupDefaults.notes}
        sourceContext="job-followup"
        onSuccess={() => {
          setSelectedJob(null)
        }}
      />

      {/* Decline Job Modal */}
      <Modal
        isOpen={showDeclineModal}
        onClose={() => {
          setShowDeclineModal(false)
          setDeclineReason('')
        }}
        title="Decline Booking"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary-light/70">
            Are you sure you want to decline this booking? The client will be notified via email.
          </p>
          <div>
            <label className="block text-sm font-medium text-primary-light mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
              placeholder="Let the client know why you can't accommodate this booking..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeclineModal(false)
                setDeclineReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeclineJob}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Decline Booking
            </Button>
          </div>
        </div>
      </Modal>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetail
          service={selectedService}
          isOpen={showServiceDetail}
          onClose={() => {
            setShowServiceDetail(false)
            setSelectedService(null)
          }}
          onEdit={() => {
            setShowServiceDetail(false)
            setShowServiceForm(true)
          }}
          onDelete={handleDeleteService}
          onGetLink={handleGetBookingLink}
        />
      )}

      {/* Service Form Modal */}
      <Modal
        isOpen={showServiceForm}
        onClose={() => {
          setShowServiceForm(false)
          setSelectedService(null)
          clearServicesError()
        }}
        title={selectedService ? 'Edit Service' : 'Create New Service'}
        size="xl"
      >
        <ServiceForm
          service={selectedService || undefined}
          onSubmit={selectedService ? handleUpdateService : handleCreateService}
          onCancel={() => {
            setShowServiceForm(false)
            setSelectedService(null)
            clearServicesError()
          }}
          isLoading={servicesLoading}
        />
      </Modal>

      {/* Delete Recurring Job Modal */}
      {selectedJob && (
        <DeleteRecurringJobModal
          isOpen={showDeleteRecurringModal}
          onClose={() => setShowDeleteRecurringModal(false)}
          onDeleteOne={handleDeleteSingleJob}
          onDeleteAll={handleDeleteAllJobs}
          jobTitle={selectedJob.title}
          occurrenceCount={selectedJob.occurrenceCount}
        />
      )}

      {/* Booking Link Modal */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false)
          setBookingLink('')
        }}
        title="Booking Link"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary-light/70">
            Share this link with clients so they can view all your services and book appointments:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={bookingLink}
              readOnly
              className="flex-1 rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light"
            />
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(bookingLink)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
              className="relative min-w-[80px]"
            >
              {linkCopied ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 animate-scale-in"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Copied</span>
                </span>
              ) : (
                'Copy'
              )}
            </Button>
          </div>
          <p className="text-xs text-primary-light/60">
            Clients can select a time and book without logging in.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default SchedulingPage

