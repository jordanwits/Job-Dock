import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogDetail from '../components/JobLogDetail'
import { ConfirmationDialog } from '@/components/ui'
import { services } from '@/lib/api/services'

const JobLogDetailPage = () => {
  const [isTeamAccount, setIsTeamAccount] = useState(false)

  useEffect(() => {
    const checkTeam = async () => {
      try {
        const status = await services.billing.getStatus()
        setIsTeamAccount(status.subscriptionTier === 'team')
      } catch {
        setIsTeamAccount(false)
      }
    }
    checkTeam()
  }, [])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    selectedJobLog,
    isLoading,
    getJobLogById,
    updateJobLog,
    deleteJobLog,
    setSelectedJobLog,
  } = useJobLogStore()

  const [editingJobLogId, setEditingJobLogId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (id) {
      setSelectedJobLog(null)
      getJobLogById(id)
    }
    return () => setSelectedJobLog(null)
  }, [id, getJobLogById, setSelectedJobLog])

  const handleBack = () => {
    navigate('/app/job-logs')
  }

  const handleSaveEdit = async (data: {
    title: string
    description?: string
    location?: string
    notes?: string
    jobId?: string
    contactId?: string
    assignedTo?: string
    status?: string
  }) => {
    if (!editingJobLogId) return
    await updateJobLog(editingJobLogId, data)
    setEditingJobLogId(null)
    getJobLogById(editingJobLogId)
  }

  const handleStatusChange = async (status: 'active' | 'completed' | 'inactive') => {
    if (!selectedJobLog) return
    await updateJobLog(selectedJobLog.id, { status })
    getJobLogById(selectedJobLog.id)
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedJobLog) return
    await deleteJobLog(selectedJobLog.id)
    setShowDeleteConfirm(false)
    navigate('/app/job-logs')
  }

  if (!id) {
    navigate('/app/job-logs')
    return null
  }

  if (isLoading && !selectedJobLog) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-primary-dark rounded animate-pulse" />
        <div className="h-96 bg-primary-dark rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!selectedJobLog || selectedJobLog.id !== id) {
    return (
      <div className="space-y-6">
        <p className="text-primary-light/60">Job not found.</p>
        <button
          onClick={() => navigate('/app/job-logs')}
          className="text-primary-gold hover:underline"
        >
          Back to Jobs
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <JobLogDetail
        jobLog={selectedJobLog}
        showCreatedBy={isTeamAccount}
        onBack={handleBack}
        onEdit={() => setEditingJobLogId(selectedJobLog.id)}
        onDelete={handleDeleteClick}
        isEditing={editingJobLogId === selectedJobLog.id}
        onCancelEdit={() => setEditingJobLogId(null)}
        onSaveEdit={handleSaveEdit}
        onStatusChange={handleStatusChange}
        isLoading={isLoading}
      />

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Job"
        message="Are you sure you want to delete this job? This will also delete all time entries and photos."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  )
}

export default JobLogDetailPage
