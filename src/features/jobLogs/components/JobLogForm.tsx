import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobLogSchema, type JobLogFormData } from '../schemas/jobLogSchemas'
import type { JobLog, JobAssignment } from '../types/jobLog'
import { Input, Button, Select, Textarea } from '@/components/ui'
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
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  // "See price" controls the overall job price visibility/editing.
  // Employees should still be able to see their own assignment pay elsewhere in the app.
  const canSeeJobPrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [jobRoles, setJobRoles] = useState<Array<{ id: string; title: string }>>([])
  const [canShowAssignee, setCanShowAssignee] = useState(false)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
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
        const [usersData, billingData, rolesData] = await Promise.all([
          services.users.getAll(),
          services.billing.getStatus(),
          services.jobRoles.getAll().catch(() => []), // Gracefully handle if job roles don't exist yet
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
        if (Array.isArray(rolesData)) {
          setJobRoles(rolesData.map((r: { id: string; title: string }) => ({ id: r.id, title: r.title })))
        }
      } catch {
        setCanShowAssignee(false)
      }
    }
    load()
  }, [user?.role])

  // Initialize assignments from jobLog
  useEffect(() => {
    if (jobLog?.assignedTo) {
      if (Array.isArray(jobLog.assignedTo)) {
        // Check if it's the new format (JobAssignment[]) or old format (string[])
        if (jobLog.assignedTo.length > 0 && typeof jobLog.assignedTo[0] === 'object' && 'userId' in jobLog.assignedTo[0]) {
          // Ensure payType and hourlyRate are set for all assignments
          setAssignments((jobLog.assignedTo as JobAssignment[]).map(assignment => ({
            ...assignment,
            payType: assignment.payType || 'job',
            hourlyRate: assignment.hourlyRate ?? null,
            price: assignment.price ?? null,
          })))
        } else {
          // Old format: string[]
          setAssignments((jobLog.assignedTo as string[]).map(id => ({ userId: id, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null })))
        }
      } else {
        // Old format: single string
        setAssignments([{ userId: jobLog.assignedTo as string, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }])
      }
    } else {
      setAssignments([])
    }
  }, [jobLog])

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
      description: jobLog?.description ?? '',
      location: jobLog?.location ?? '',
      notes: jobLog?.notes ?? '',
      contactId: jobLog?.contactId ?? '',
      price: jobLog?.price ?? null,
      serviceId: jobLog?.serviceId ?? undefined,
      assignedTo: (() => {
        // Handle both old format (string/string[]) and new format (JobAssignment[])
        if (!jobLog?.assignedTo) return []
        if (Array.isArray(jobLog.assignedTo)) {
          if (jobLog.assignedTo.length > 0 && typeof jobLog.assignedTo[0] === 'object' && 'userId' in jobLog.assignedTo[0]) {
            // Ensure payType and hourlyRate are set for all assignments
            return (jobLog.assignedTo as JobAssignment[]).map(assignment => ({
              ...assignment,
              payType: assignment.payType || 'job',
              hourlyRate: assignment.hourlyRate ?? null,
              price: assignment.price ?? null,
            }))
          }
          return (jobLog.assignedTo as string[]).map(id => ({ userId: id, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }))
        }
        // Old format: single string
        return [{ userId: jobLog.assignedTo as string, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }]
      })(),
      status: (jobLog?.status === 'archived' ? 'inactive' : jobLog?.status) ?? 'active',
    },
  })

  // Sync assignments with form when they change
  useEffect(() => {
    setValue('assignedTo', assignments.length > 0 ? assignments : undefined)
  }, [assignments, setValue])

  const handleFormSubmit = async (data: JobLogFormData) => {
    // Convert empty/undefined assignedTo to null so backend clears it
    // Ensure price is explicitly included and properly normalized
    const formData: any = {
      ...data,
      assignedTo: Array.isArray(data.assignedTo) && data.assignedTo.length > 0 
        ? data.assignedTo.filter(a => a.userId && a.userId.trim() !== '')
        : null,
    }

    // Only include job price if user has permission.
    if (canSeeJobPrices) {
      formData.price =
        data.price === '' || data.price === null || data.price === undefined
          ? null
          : typeof data.price === 'number'
            ? data.price
            : Number(data.price)
    } else {
      delete formData.price
    }

    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 sm:space-y-4">
      <Input
        label="Title"
        {...register('title')}
        error={errors.title?.message}
        placeholder="Job site name or description"
      />
      <Textarea
        label="Description"
        {...register('description')}
        error={errors.description?.message ? String(errors.description.message) : undefined}
        placeholder="Add any details for this job"
        rows={3}
      />
      <Input
        label="Location"
        {...register('location')}
        error={errors.location?.message}
        placeholder="Address or job site location"
      />
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">Price</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-light/70 text-sm">$</span>
          <Controller
            name="price"
            control={control}
            render={({ field }) => (
              <Input
                type="number"
                step="0.01"
                min="0"
                {...field}
                // Don't reveal the price when permission is off.
                value={
                  !canSeeJobPrices
                    ? ''
                    : field.value === null || field.value === undefined
                      ? ''
                      : field.value
                }
                onChange={(e) => {
                  if (!canSeeJobPrices) return
                  const value = e.target.value
                  if (value === '' || value === null || value === undefined) {
                    field.onChange(null)
                  } else {
                    const num = Number(value)
                    field.onChange(Number.isFinite(num) ? num : null)
                  }
                }}
                error={errors.price?.message ? String(errors.price.message) : undefined}
                placeholder="0.00"
                className="pl-7"
                disabled={!canSeeJobPrices}
              />
            )}
          />
        </div>
        {!canSeeJobPrices ? (
          <p className="text-xs mt-1 text-yellow-400">
            Insufficient permissions to view or edit job price.
          </p>
        ) : (
          <p className="text-xs text-primary-light/50 mt-1">
            This is the job price shown on the Jobs page (not the individual assignee pay).
          </p>
        )}
      </div>
      <Textarea
        label="Notes"
        {...register('notes')}
        error={errors.notes?.message ? String(errors.notes.message) : undefined}
        placeholder="Internal notes (optional)"
        rows={3}
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
        <div className="pt-2">
          <label className="block text-sm font-medium text-primary-light mb-2">
            Assign to Team Members (with Roles & Pricing)
          </label>
          <p className="text-xs text-primary-light/50 mb-4">
            Assign team members to this job and set their role and individual pricing. Team members can only see their own pricing.
          </p>
          <div className="space-y-3">
            {assignments.length === 0 ? (
              <div className="border border-primary-blue/30 rounded-lg p-4 bg-primary-dark-secondary/30 text-center">
                <p className="text-sm text-primary-light/70 mb-3">No team members assigned yet</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                  const newAssignments = [{ userId: '', role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }]
                  setAssignments(newAssignments)
                  setValue('assignedTo', newAssignments)
                  }}
                  className="text-sm"
                >
                  + Add Team Member
                </Button>
              </div>
            ) : (
              <>
                {assignments.map((assignment, index) => {
                  const member = teamMembers.find(m => m.id === assignment.userId)
                  return (
                    <div key={index} className="border border-primary-blue rounded-lg p-3 bg-primary-dark-secondary/50 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start gap-3">
                        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Team Member
                            </label>
                            <Select
                              value={assignment.userId}
                              onChange={(e) => {
                                const newAssignments = [...assignments]
                                newAssignments[index] = { ...assignment, userId: e.target.value }
                                setAssignments(newAssignments)
                                setValue('assignedTo', newAssignments)
                              }}
                              options={[
                                { value: '', label: 'Select member' },
                                ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Role
                            </label>
                            {jobRoles.length > 0 ? (
                              <Select
                                value={assignment.roleId || 'custom'}
                                onChange={(e) => {
                                  const newAssignments = [...assignments]
                                  const selectedRoleId = e.target.value
                                  if (selectedRoleId === 'custom') {
                                    // Custom role - clear roleId, keep role text
                                    newAssignments[index] = { ...assignment, roleId: undefined, role: assignment.role || '' }
                                  } else {
                                    // Selected role from list
                                    const selectedRole = jobRoles.find(r => r.id === selectedRoleId)
                                    newAssignments[index] = {
                                      ...assignment,
                                      roleId: selectedRoleId,
                                      role: selectedRole?.title || assignment.role || '',
                                    }
                                  }
                                  setAssignments(newAssignments)
                                  setValue('assignedTo', newAssignments)
                                }}
                                options={[
                                  { value: 'custom', label: 'Custom...' },
                                  ...jobRoles.map(r => ({ value: r.id, label: r.title })),
                                ]}
                              />
                            ) : null}
                            {(assignment.roleId === undefined || assignment.roleId === 'custom' || jobRoles.length === 0) && (
                              <Input
                                type="text"
                                value={assignment.role}
                                onChange={(e) => {
                                  const newAssignments = [...assignments]
                                  newAssignments[index] = { ...assignment, role: e.target.value, roleId: undefined }
                                  setAssignments(newAssignments)
                                  setValue('assignedTo', newAssignments)
                                }}
                                placeholder="e.g., Lead, Assistant"
                                className="text-sm mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Pay Type
                            </label>
                            <Select
                              value={assignment.payType || 'job'}
                              onChange={(e) => {
                                const newAssignments = [...assignments]
                                const payType = e.target.value as 'job' | 'hourly'
                                newAssignments[index] = {
                                  ...assignment,
                                  payType,
                                  // Clear price/hourlyRate when switching
                                  price: payType === 'job' ? assignment.price : null,
                                  hourlyRate: payType === 'hourly' ? assignment.hourlyRate : null,
                                }
                                setAssignments(newAssignments)
                                setValue('assignedTo', newAssignments)
                              }}
                              options={[
                                { value: 'job', label: 'By Job' },
                                { value: 'hourly', label: 'By Hour' },
                              ]}
                            />
                          </div>
                          {assignment.payType === 'hourly' ? (
                            <div>
                              <label className="block text-xs font-medium text-primary-light/70 mb-1">
                                Hourly Rate
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-light/70 text-sm">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={assignment.hourlyRate ?? ''}
                                  onChange={(e) => {
                                    const newAssignments = [...assignments]
                                    const hourlyRateValue = e.target.value === '' ? null : parseFloat(e.target.value)
                                    newAssignments[index] = {
                                      ...assignment,
                                      hourlyRate: isNaN(hourlyRateValue as number) ? null : hourlyRateValue,
                                    }
                                    setAssignments(newAssignments)
                                    setValue('assignedTo', newAssignments)
                                  }}
                                  placeholder="0.00"
                                  className="pl-7 text-sm"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-medium text-primary-light/70 mb-1">
                                Price
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-light/70 text-sm">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={assignment.price ?? ''}
                                  onChange={(e) => {
                                    const newAssignments = [...assignments]
                                    const priceValue = e.target.value === '' ? null : parseFloat(e.target.value)
                                    newAssignments[index] = { ...assignment, price: isNaN(priceValue as number) ? null : priceValue }
                                    setAssignments(newAssignments)
                                    setValue('assignedTo', newAssignments)
                                  }}
                                  placeholder="0.00"
                                  className="pl-7 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newAssignments = assignments.filter((_, i) => i !== index)
                            setAssignments(newAssignments)
                            // Allow empty assignments - set to empty array or undefined
                            if (newAssignments.length === 0) {
                              setValue('assignedTo', undefined)
                            } else {
                              setValue('assignedTo', newAssignments)
                            }
                          }}
                          className="text-red-500 hover:text-red-600 text-sm font-medium mt-3 sm:mt-0 sm:self-start"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const newAssignments = [...assignments, { userId: '', role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }]
                    setAssignments(newAssignments)
                    setValue('assignedTo', newAssignments)
                  }}
                  className="w-full text-sm"
                >
                  + Add Another Team Member
                </Button>
              </>
            )}
          </div>
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1">{errors.assignedTo.message}</p>
          )}
        </div>
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
