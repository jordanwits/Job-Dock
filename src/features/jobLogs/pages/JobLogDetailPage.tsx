import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogDetail from '../components/JobLogDetail'
import { ConfirmationDialog, Card, Button } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

const JobLogDetailPage = () => {
  const { theme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isTeamAccount, setIsTeamAccount] = useState(false)

  useEffect(() => {
    const checkTeam = async () => {
      try {
        const status = await services.billing.getStatus()
        setIsTeamAccount(status.subscriptionTier === 'team' || status.subscriptionTier === 'team-plus')
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
  const [sentBanner, setSentBanner] = useState<{ type: 'success' | 'failed'; message: string } | null>(null)

  // Show success/failed banner when returning from create quote/invoice with save+send
  useEffect(() => {
    const quoteSent = searchParams.get('quoteSent')
    const invoiceSent = searchParams.get('invoiceSent')
    const quoteFailed = searchParams.get('quoteFailed')
    const invoiceFailed = searchParams.get('invoiceFailed')
    if (quoteSent === '1') {
      setSentBanner({ type: 'success', message: 'Quote sent successfully' })
      const next = new URLSearchParams(searchParams)
      next.delete('quoteSent')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    } else if (invoiceSent === '1') {
      setSentBanner({ type: 'success', message: 'Invoice sent successfully' })
      const next = new URLSearchParams(searchParams)
      next.delete('invoiceSent')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    } else if (quoteFailed === '1') {
      setSentBanner({ type: 'failed', message: 'Failed to send quote' })
      const next = new URLSearchParams(searchParams)
      next.delete('quoteFailed')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    } else if (invoiceFailed === '1') {
      setSentBanner({ type: 'failed', message: 'Failed to send invoice' })
      const next = new URLSearchParams(searchParams)
      next.delete('invoiceFailed')
      setSearchParams(next, { replace: true })
      setTimeout(() => setSentBanner(null), 5000)
    }
  }, [searchParams, setSearchParams])

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
    price?: number | null
    serviceId?: string
    assignedTo?: import('../types/jobLog').JobAssignment[]
    status?: string
    payChangeEffectiveDate?: string
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
        <div className={cn(
          "h-10 w-64 rounded animate-pulse",
          theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
        )} />
        <div className={cn(
          "h-96 rounded-xl animate-pulse",
          theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
        )} />
      </div>
    )
  }

  if (!selectedJobLog || selectedJobLog.id !== id) {
    return (
      <div className="space-y-6">
        <p className={cn(
          theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
        )}>Job not found.</p>
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
      {sentBanner && (
        <Card
          className={
            sentBanner.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20'
              : 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20'
          }
        >
          <div className="flex items-center justify-between">
            <p
              className={
                sentBanner.type === 'success'
                  ? 'text-sm text-green-400'
                  : 'text-sm text-red-400'
              }
            >
              {sentBanner.type === 'success' ? '✓ ' : ''}
              {sentBanner.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSentBanner(null)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}
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
        onQuoteSent={(message) => {
          setSentBanner({ type: 'success', message })
          setTimeout(() => setSentBanner(null), 5000)
        }}
        onInvoiceSent={(message) => {
          setSentBanner({ type: 'success', message })
          setTimeout(() => setSentBanner(null), 5000)
        }}
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
