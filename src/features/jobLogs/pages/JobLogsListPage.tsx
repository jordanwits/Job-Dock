import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobLogStore } from '../store/jobLogStore'
import JobLogList from '../components/JobLogList'
import JobLogForm from '../components/JobLogForm'
import { Modal, Button } from '@/components/ui'
import type { CreateJobLogData } from '../types/jobLog'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'

const JobLogsListPage = () => {
  const { user } = useAuthStore()
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
  const navigate = useNavigate()
  const { createJobLog, isLoading } = useJobLogStore()
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleSelectJobLog = (id: string) => {
    navigate(`/app/job-logs/${id}`)
  }

  const handleCreate = async (data: CreateJobLogData) => {
    const created = await createJobLog(data)
    setShowCreateForm(false)
    navigate(`/app/job-logs/${created.id}`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-primary-light tracking-tight">
            <span className="text-primary-gold">Jobs</span>
          </h1>
          <p className="text-sm md:text-base text-primary-light/60">
            Create jobs, track time, capture photos, and take notes on jobsites
          </p>
        </div>
        {user?.canCreateJobs !== false && (
          <Button onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
            Create Job
          </Button>
        )}
      </div>

      <JobLogList
        onCreateClick={() => setShowCreateForm(true)}
        onSelectJobLog={handleSelectJobLog}
        showCreatedBy={isTeamAccount}
      />

      <Modal isOpen={showCreateForm} onClose={() => setShowCreateForm(false)} title="New Job" size="2xl">
        <JobLogForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isLoading}
        />
      </Modal>
    </div>
  )
}

export default JobLogsListPage
