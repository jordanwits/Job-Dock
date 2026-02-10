import { useState } from 'react'
import { format } from 'date-fns'
import { Card, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { JobLog } from '../types/jobLog'
import JobLogForm from './JobLogForm'
import TimeTracker from './TimeTracker'
import PhotoCapture from './PhotoCapture'
import JobLogNotes from './JobLogNotes'

interface JobLogDetailProps {
  jobLog: JobLog
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  isEditing: boolean
  onCancelEdit: () => void
  onSaveEdit: (data: { title: string; description?: string; location?: string; notes?: string; jobId?: string; contactId?: string; status?: string }) => Promise<void>
  isLoading?: boolean
}

type Tab = 'clock' | 'photos' | 'notes'

const JobLogDetail = ({
  jobLog,
  onBack,
  onEdit,
  onDelete,
  isEditing,
  onCancelEdit,
  onSaveEdit,
  isLoading,
}: JobLogDetailProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('clock')

  if (isEditing) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <h3 className="text-lg font-semibold text-primary-light mb-4">Edit Job</h3>
          <JobLogForm
            jobLog={jobLog}
            onSubmit={onSaveEdit}
            onCancel={onCancelEdit}
            isLoading={isLoading}
          />
        </Card>
      </div>
    )
  }

  const hasOverview = jobLog.location || jobLog.contact

  return (
    <div className="space-y-6 w-full">
      {/* Compact header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-primary-light/60 hover:text-primary-gold mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Jobs
          </button>
          <h1 className="text-2xl font-bold text-primary-light truncate">{jobLog.title}</h1>
          <p className="text-sm text-primary-light/50 mt-0.5">
            {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-400 border-red-500/50 hover:bg-red-500/10">
            Delete
          </Button>
        </div>
      </div>

      {/* Overview: contact and location */}
      {hasOverview && (
        <dl className="space-y-3">
          {jobLog.location && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">Location</dt>
              <dd className="text-sm text-primary-light/90 mt-1">{jobLog.location}</dd>
            </div>
          )}
          {jobLog.contact && (
            <div>
              <dt className="text-xs font-medium text-primary-light/50 uppercase tracking-wider">Contact</dt>
              <dd className="text-sm text-primary-light/90 mt-1">
                {jobLog.contact.name}
                {jobLog.contact.email && <span className="text-primary-light/60"> · {jobLog.contact.email}</span>}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Tabbed tools: Clock | Photos | Notes */}
      <div className="pt-4">
        <div className="flex gap-1 border-b border-primary-blue mb-4">
          <button
            onClick={() => setActiveTab('clock')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              activeTab === 'clock'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/60 hover:text-primary-light'
            )}
          >
            Clock
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              activeTab === 'photos'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/60 hover:text-primary-light'
            )}
          >
            Photos
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              activeTab === 'notes'
                ? 'text-primary-gold border-b-2 border-primary-gold'
                : 'text-primary-light/60 hover:text-primary-light'
            )}
          >
            Notes
          </button>
        </div>

        {activeTab === 'clock' && (
          <TimeTracker jobLogId={jobLog.id} jobLogTitle={jobLog.title} timeEntries={jobLog.timeEntries ?? []} />
        )}

        {activeTab === 'photos' && (
          <PhotoCapture jobLogId={jobLog.id} photos={jobLog.photos ?? []} />
        )}

        {activeTab === 'notes' && (
          <JobLogNotes jobLogId={jobLog.id} initialNotes={jobLog.notes ?? ''} />
        )}
      </div>
    </div>
  )
}

export default JobLogDetail
