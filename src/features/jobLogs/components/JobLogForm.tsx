import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobLogSchema, type JobLogFormData } from '../schemas/jobLogSchemas'
import type { JobLog } from '../types/jobLog'
import { Input, Button, Select } from '@/components/ui'
import { useContactStore } from '@/features/crm/store/contactStore'

interface JobLogFormProps {
  jobLog?: JobLog
  onSubmit: (data: JobLogFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const JobLogForm = ({ jobLog, onSubmit, onCancel, isLoading }: JobLogFormProps) => {
  const { contacts, fetchContacts } = useContactStore()
  const [selectedContactId, setSelectedContactId] = useState<string>(jobLog?.contactId ?? '')

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<JobLogFormData>({
    resolver: zodResolver(jobLogSchema),
    defaultValues: {
      title: jobLog?.title ?? '',
      location: jobLog?.location ?? '',
      contactId: jobLog?.contactId ?? '',
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
