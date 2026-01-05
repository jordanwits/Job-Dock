import { useState, useEffect } from 'react'
import { useJobStore } from '../store/jobStore'
import { useServiceStore } from '../store/serviceStore'
import Calendar from '../components/Calendar'
import JobList from '../components/JobList'
import JobForm from '../components/JobForm'
import JobDetail from '../components/JobDetail'
import ServiceList from '../components/ServiceList'
import ServiceForm from '../components/ServiceForm'
import { Button, Modal, Card } from '@/components/ui'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const SchedulingPage = () => {
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
    setSelectedService,
    fetchServices,
    clearError: clearServicesError,
  } = useServiceStore()

  const [showJobForm, setShowJobForm] = useState(false)
  const [editingJob, setEditingJob] = useState<typeof selectedJob>(null)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'calendar' | 'jobs' | 'services'>('calendar')

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
      }
    } catch (error) {
      // Error handled by store
    }
  }

  const handleDeleteJob = async () => {
    if (selectedJob) {
      try {
        await deleteJob(selectedJob.id)
        setSelectedJob(null)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleCreateService = async (data: any) => {
    try {
      await createService(data)
      setShowServiceForm(false)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleUpdateService = async (data: any) => {
    if (selectedService) {
      try {
        await updateService({ ...data, id: selectedService.id })
        setSelectedService(null)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const error = jobsError || servicesError

  return (
    <div className="space-y-6 h-full flex flex-col">
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
            <Button onClick={() => setShowJobForm(true)} className="w-full sm:w-auto">
              Schedule Job
            </Button>
          )}
          {activeTab === 'services' && (
            <Button onClick={() => setShowServiceForm(true)} className="w-full sm:w-auto">
              Create Service
            </Button>
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
      <div className="flex-1 overflow-hidden">
        {activeTab === 'calendar' && (
          <div className="h-full">
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
                if (service) setSelectedService(service)
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
        />
      )}

      {/* Service Form Modal */}
      <Modal
        isOpen={showServiceForm || !!selectedService}
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
    </div>
  )
}

export default SchedulingPage

