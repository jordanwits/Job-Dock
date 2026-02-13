import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobLogSchema, type JobLogFormData } from '../schemas/jobLogSchemas'
import type { JobLog } from '../types/jobLog'
import { Input, Button, Select } from '@/components/ui'
import MultiSelect from '@/components/ui/MultiSelect'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useAuthStore } from '@/features/auth'
import { services } from '@/lib/api/services'

interface TeamMemberOption {
  id: string
  name: string
}

interface JobLogFormProps {
  jobLog?: JobLog
  onSubmit: (data: JobLogFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'inactive', label: 'Inactive' },
] as const

const JobLogForm = ({ jobLog, onSubmit, onCancel, isLoading }: JobLogFormProps) => {
  const { contacts, fetchContacts } = useContactStore()
  const { user } = useAuthStore()
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [canShowAssignee, setCanShowAssignee] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string>(jobLog?.contactId ?? '')
  const [selectedStatus, setSelectedStatus] = useState<string>(
    jobLog?.status && ['active', 'completed', 'inactive', 'archived'].includes(jobLog.status)
      ? jobLog.status === 'archived' ? 'inactive' : jobLog.status
      : 'active'
  )

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  useEffect(() => {
    const role = user?.role
    const canAssign = role !== 'employee'
    if (!canAssign) {
      setCanShowAssignee(false)
      return
    }
    const load = async () => {
      try {
        const [usersData, billingData] = await Promise.all([
          services.users.getAll(),
          services.billing.getStatus(),
        ])
        const hasTeamTier = !!billingData?.canInviteTeamMembers || billingData?.subscriptionTier === 'team'
        const hasTeamMembers = Array.isArray(usersData) && usersData.length > 0
        setCanShowAssignee(hasTeamTier || hasTeamMembers)
        if (hasTeamTier || hasTeamMembers) {
          setTeamMembers(
            (usersData || []).map((m: { id: string; name: string; email?: string }) => ({
              id: m.id,
              name: m.name || m.email || 'Unknown',
            }))
          )
        }
      } catch {
        setCanShowAssignee(false)
      }
    }
    load()
  }, [user?.role])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
  } = useForm<JobLogFormData>({
    resolver: zodResolver(jobLogSchema),
    defaultValues: {
      title: jobLog?.title ?? '',
      location: jobLog?.location ?? '',
      contactId: jobLog?.contactId ?? '',
      assignedTo: Array.isArray(jobLog?.assignedTo) ? jobLog.assignedTo : jobLog?.assignedTo ? [jobLog.assignedTo] : [],
      status: (jobLog?.status === 'archived' ? 'inactive' : jobLog?.status) ?? 'active',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Title"
        {...register('title')}
        error={errors.title?.message}
        placeholder="Job site name or description"
      />
      <Input
        label="Location"
        {...register('location')}
        error={errors.location?.message}
        placeholder="Address or job site location"
      />
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Status
        </label>
        <Select
          value={selectedStatus}
          onChange={(e) => {
            const v = e.target.value
            setSelectedStatus(v)
            setValue('status', v as 'active' | 'completed' | 'inactive')
          }}
          options={statusOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Contact (optional)
        </label>
        <Select
          value={selectedContactId}
          onChange={(e) => {
            const v = e.target.value
            setSelectedContactId(v)
            setValue('contactId', v)
          }}
          options={[
            { value: '', label: 'None' },
            ...contacts.map((c) => ({
              value: c.id,
              label: `${c.firstName} ${c.lastName}`,
            })),
          ]}
        />
      </div>
      {canShowAssignee && (
        <Controller
          name="assignedTo"
          control={control}
          render={({ field }) => (
            <MultiSelect
              label="Assign to"
              value={Array.isArray(field.value) ? field.value : field.value ? [field.value] : []}
              onChange={(value) => field.onChange(value)}
              options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
              placeholder="Select team members"
            />
          )}
        />
      )}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : jobLog ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default JobLogForm
