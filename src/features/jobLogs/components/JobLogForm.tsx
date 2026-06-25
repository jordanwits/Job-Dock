import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobLogSchema, type JobLogFormData } from '../schemas/jobLogSchemas'
import type { JobLog, JobAssignment } from '../types/jobLog'
import {
  Alert,
  AlertIcon,
  AppButton,
  PlusIcon,
  SearchableSelectField,
  SelectField,
  TextAreaField,
  TextField,
  labelCls,
} from './jobLogsUi'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useAuthStore } from '@/features/auth'
import { services } from '@/lib/api/services'
import { getTeamAssignmentRoleValidationMessage } from '@/lib/utils/assignmentRoleValidation'
import { PayChangeEffectiveDateModal } from './PayChangeEffectiveDateModal'

function hasPayChangeWithTimeEntries(
  oldAssignments: JobAssignment[] | undefined,
  newAssignments: JobAssignment[] | null,
  timeEntries: { userId?: string }[] | undefined
): boolean {
  if (!newAssignments || newAssignments.length === 0) return false
  const entriesByUser = new Set((timeEntries ?? []).map(e => e.userId).filter(Boolean))
  if (entriesByUser.size === 0) return false
  const oldByUser = new Map<string, JobAssignment>()
  for (const a of oldAssignments ?? []) {
    if (a?.userId) oldByUser.set(a.userId, a)
  }
  for (const newA of newAssignments) {
    const userId = newA?.userId
    if (!userId || !entriesByUser.has(userId)) continue
    const oldA = oldByUser.get(userId)
    const oldRate = oldA?.payType === 'hourly' ? oldA.hourlyRate : oldA?.price
    const newRate = newA?.payType === 'hourly' ? newA.hourlyRate : newA?.price
    if (oldRate !== newRate) return true
  }
  return false
}

interface TeamMemberOption {
  id: string
  name: string
}

interface JobLogFormProps {
  jobLog?: JobLog
  onSubmit: (data: JobLogFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  isSimpleCreate?: boolean // When true and not editing, show only title, description, location, contact
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'inactive', label: 'Inactive' },
] as const

const JobLogForm = ({
  jobLog,
  onSubmit,
  onCancel,
  isLoading,
  isSimpleCreate = false,
}: JobLogFormProps) => {
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
  const [showPayChangeModal, setShowPayChangeModal] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<any>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>(
    jobLog?.status && ['active', 'completed', 'inactive', 'archived'].includes(jobLog.status)
      ? jobLog.status === 'archived'
        ? 'inactive'
        : jobLog.status
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
        const hasTeamTier =
          !!billingData?.canInviteTeamMembers ||
          billingData?.subscriptionTier === 'team' ||
          billingData?.subscriptionTier === 'team-plus'
        setCanShowAssignee(hasTeamTier)
        if (hasTeamTier) {
          setTeamMembers(
            (usersData || []).map((m: { id: string; name: string; email?: string }) => ({
              id: m.id,
              name: m.name || m.email || 'Unknown',
            }))
          )
        }
        if (Array.isArray(rolesData)) {
          setJobRoles(
            rolesData.map((r: { id: string; title: string }) => ({ id: r.id, title: r.title }))
          )
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
        if (
          jobLog.assignedTo.length > 0 &&
          typeof jobLog.assignedTo[0] === 'object' &&
          'userId' in jobLog.assignedTo[0]
        ) {
          // Ensure payType and hourlyRate are set for all assignments
          setAssignments(
            (jobLog.assignedTo as JobAssignment[]).map(assignment => ({
              ...assignment,
              payType: assignment.payType || 'job',
              hourlyRate: assignment.hourlyRate ?? null,
              price: assignment.price ?? null,
            }))
          )
        } else {
          // Old format: string[]
          setAssignments(
            (jobLog.assignedTo as string[]).map(id => ({
              userId: id,
              role: 'Team Member',
              price: null,
              payType: 'job' as const,
              hourlyRate: null,
            }))
          )
        }
      } else {
        // Old format: single string
        setAssignments([
          {
            userId: jobLog.assignedTo as string,
            role: 'Team Member',
            price: null,
            payType: 'job' as const,
            hourlyRate: null,
          },
        ])
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
          if (
            jobLog.assignedTo.length > 0 &&
            typeof jobLog.assignedTo[0] === 'object' &&
            'userId' in jobLog.assignedTo[0]
          ) {
            // Ensure payType and hourlyRate are set for all assignments
            return (jobLog.assignedTo as JobAssignment[]).map(assignment => ({
              ...assignment,
              payType: assignment.payType || 'job',
              hourlyRate: assignment.hourlyRate ?? null,
              price: assignment.price ?? null,
            }))
          }
          return (jobLog.assignedTo as string[]).map(id => ({
            userId: id,
            role: 'Team Member',
            price: null,
            payType: 'job' as const,
            hourlyRate: null,
          }))
        }
        // Old format: single string
        return [
          {
            userId: jobLog.assignedTo as string,
            role: 'Team Member',
            price: null,
            payType: 'job' as const,
            hourlyRate: null,
          },
        ]
      })(),
      status: (jobLog?.status === 'archived' ? 'inactive' : jobLog?.status) ?? 'active',
    },
  })

  // Match existing roles to job roles when jobRoles are loaded
  useEffect(() => {
    if (jobRoles.length > 0 && assignments.length > 0 && jobLog) {
      const updatedAssignments = assignments.map(assignment => {
        // If roleId is already set and valid, keep it
        if (
          assignment.roleId &&
          assignment.roleId !== 'custom' &&
          jobRoles.some(r => r.id === assignment.roleId)
        ) {
          return assignment
        }

        // If role exists but no roleId or invalid roleId, try to match it to a job role
        if (assignment.role) {
          const matchingRole = jobRoles.find(r => r.title === assignment.role)
          if (matchingRole) {
            // Found a match - set the roleId
            return {
              ...assignment,
              roleId: matchingRole.id,
            }
          } else {
            // No match found - this is a custom role, set roleId to 'custom'
            return {
              ...assignment,
              roleId: 'custom',
            }
          }
        }

        // No role set - keep as is
        return assignment
      })

      // Only update if something changed to avoid infinite loops
      const hasChanges = updatedAssignments.some(
        (updated, index) => updated.roleId !== assignments[index]?.roleId
      )

      if (hasChanges) {
        setAssignments(updatedAssignments)
        setValue('assignedTo', updatedAssignments)
      }
    }
  }, [jobRoles, jobLog?.id, assignments, setValue])

  // Sync assignments with form when they change
  useEffect(() => {
    setValue('assignedTo', assignments.length > 0 ? assignments : undefined)
  }, [assignments, setValue])

  const handleFormSubmit = async (data: JobLogFormData) => {
    if (submitError) setSubmitError(null)

    if (canShowAssignee) {
      const roleMsg = getTeamAssignmentRoleValidationMessage(assignments, jobRoles)
      if (roleMsg) {
        setSubmitError(roleMsg)
        return
      }
    }

    // Convert empty/undefined assignedTo to null so backend clears it
    // Ensure price is explicitly included and properly normalized
    const normalizedAssignedTo =
      Array.isArray(data.assignedTo) && data.assignedTo.length > 0
        ? data.assignedTo
            .filter(a => a.userId && a.userId.trim() !== '')
            .map(a => {
              const normalizedA = {
                ...a,
                roleId: a.roleId === 'custom' ? undefined : a.roleId,
              }
              if (!normalizedA.roleId && normalizedA.role && jobRoles.length > 0) {
                const match = jobRoles.find(r => r.title === normalizedA.role)
                if (match) normalizedA.roleId = match.id
              }
              return normalizedA
            })
        : null

    const formData: any = {
      ...data,
      assignedTo: normalizedAssignedTo,
    }

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

    const oldAssignments = (() => {
      if (!jobLog?.assignedTo) return []
      const a = jobLog.assignedTo
      if (
        Array.isArray(a) &&
        a.length > 0 &&
        typeof a[0] === 'object' &&
        a[0] !== null &&
        'userId' in a[0]
      ) {
        return a as JobAssignment[]
      }
      return []
    })()

    const needsEffectiveDate =
      jobLog &&
      canSeeJobPrices &&
      hasPayChangeWithTimeEntries(oldAssignments, normalizedAssignedTo, jobLog.timeEntries)

    if (needsEffectiveDate) {
      setPendingFormData(formData)
      setShowPayChangeModal(true)
      return
    }

    await onSubmit(formData)
  }

  const handleInvalidSubmit = (invalid: Record<string, unknown>) => {
    const messages: string[] = []
    const walk = (obj: unknown, path: string) => {
      if (!obj || typeof obj !== 'object') return
      const o = obj as Record<string, unknown>
      if (typeof o.message === 'string') {
        messages.push(path ? `${path}: ${o.message}` : o.message)
      }
      for (const key of Object.keys(o)) {
        if (key === 'message' || key === 'type' || key === 'ref') continue
        walk(o[key], path ? `${path}.${key}` : key)
      }
    }
    walk(invalid, '')
    setSubmitError(
      messages.length > 0
        ? `Fix these fields: ${messages.slice(0, 3).join(' | ')}`
        : 'Form is invalid. Please review the fields and try again.'
    )
  }

  const handlePayChangeModalConfirm = async (effectiveDate: string) => {
    if (!pendingFormData) return
    const dataWithEffective = { ...pendingFormData, payChangeEffectiveDate: effectiveDate }
    setShowPayChangeModal(false)
    setPendingFormData(null)
    await onSubmit(dataWithEffective)
  }

  // Determine if we should show simplified form (simple create mode and not editing)
  const showSimplifiedForm = isSimpleCreate && !jobLog

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-5 sm:space-y-4">
      <TextField
        label="Title"
        {...register('title')}
        error={errors.title?.message}
        placeholder="Job site name or description"
      />
      <TextAreaField
        label="Description"
        {...register('description')}
        error={errors.description?.message ? String(errors.description.message) : undefined}
        placeholder="Add any details for this job"
        rows={3}
      />
      <TextField
        label="Location"
        {...register('location')}
        error={errors.location?.message}
        placeholder="Address or job site location"
      />

      {/* Contact field - shown in both simplified and full forms */}
      {showSimplifiedForm ? (
        <SearchableSelectField
          label="Contact *"
          placeholder="Select a contact"
          searchPlaceholder="Search by name or company..."
          value={selectedContactId}
          onChange={v => {
            setSelectedContactId(v)
            setValue('contactId', v)
          }}
          options={[
            { value: '', label: 'Select a contact' },
            ...contacts.map(c => ({
              value: c.id,
              label:
                `${c.firstName} ${c.lastName}${c.company ? ` - ${c.company}` : ''}`.trim() ||
                c.email ||
                c.id,
            })),
          ]}
        />
      ) : null}

      {/* All other fields - only show when NOT in simplified create mode */}
      {!showSimplifiedForm && (
        <>
          <div>
            <label className={labelCls}>Price</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">
                $
              </span>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <TextField
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
                    onChange={e => {
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
                    className="pl-7 font-mono tabular-nums"
                    disabled={!canSeeJobPrices}
                  />
                )}
              />
            </div>
            {!canSeeJobPrices ? (
              <p className="mt-1.5 text-[13px] text-warning">
                Insufficient permissions to view or edit job price.
              </p>
            ) : (
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-subtle">
                This is the job price shown on the Jobs page (not the individual assignee pay).
              </p>
            )}
          </div>
          <TextAreaField
            label="Notes"
            {...register('notes')}
            error={errors.notes?.message ? String(errors.notes.message) : undefined}
            placeholder="Internal notes (optional)"
            rows={3}
          />
          <SelectField
            label="Status"
            value={selectedStatus}
            onChange={e => {
              const v = e.target.value
              setSelectedStatus(v)
              setValue('status', v as 'active' | 'completed' | 'inactive')
            }}
            options={statusOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelectField
            label="Contact (optional)"
            placeholder="None"
            searchPlaceholder="Search by name or company..."
            value={selectedContactId}
            onChange={v => {
              setSelectedContactId(v)
              setValue('contactId', v)
            }}
            options={[
              { value: '', label: 'None' },
              ...contacts.map(c => ({
                value: c.id,
                label:
                  `${c.firstName} ${c.lastName}${c.company ? ` - ${c.company}` : ''}`.trim() ||
                  c.email ||
                  c.id,
              })),
            ]}
          />
        </>
      )}
      {!showSimplifiedForm && canShowAssignee && (
        <div className="pt-2">
          <label className={labelCls}>Assign to Team Members (with Roles &amp; Pricing)</label>
          <p className="mb-4 text-[13px] leading-relaxed text-ink-subtle">
            Assign team members to this job and set their role and individual pricing. Team members
            can only see their own pricing.
          </p>
          <div className="space-y-3">
            {assignments.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface-2 p-4 text-center">
                <p className="mb-3 text-sm text-ink-muted">No team members assigned yet</p>
                <AppButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newAssignments = [
                      {
                        userId: '',
                        role: undefined,
                        roleId: undefined,
                        price: null,
                        payType: 'job' as const,
                        hourlyRate: null,
                      },
                    ]
                    setAssignments(newAssignments)
                    setValue('assignedTo', newAssignments)
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Team Member
                </AppButton>
              </div>
            ) : (
              <>
                {assignments.map((assignment, index) => {
                  const member = teamMembers.find(m => m.id === assignment.userId)
                  return (
                    <div
                      key={index}
                      className="space-y-3 rounded-xl border border-line bg-surface-2 p-3"
                    >
                      <div className="flex flex-col items-start gap-3 sm:flex-row">
                        <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-muted">
                              Team Member
                            </label>
                            <SelectField
                              aria-label="Team Member"
                              value={assignment.userId}
                              onChange={e => {
                                const newAssignments = [...assignments]
                                newAssignments[index] = { ...assignment, userId: e.target.value }
                                setAssignments(newAssignments)
                                setValue('assignedTo', newAssignments)
                              }}
                              options={[
                                { value: '', label: 'Select member' },
                                ...teamMembers.map(m => ({ value: m.id, label: m.name })),
                              ]}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-muted">
                              Role
                            </label>
                            {jobRoles.length > 0 ? (
                              <SelectField
                                aria-label="Role"
                                value={assignment.roleId || ''}
                                placeholder="Select role"
                                onChange={e => {
                                  const newAssignments = [...assignments]
                                  const selectedRoleId = e.target.value
                                  if (selectedRoleId === '') {
                                    // No role selected - clear roleId and role
                                    newAssignments[index] = {
                                      ...assignment,
                                      roleId: undefined,
                                      role: undefined,
                                    }
                                  } else if (selectedRoleId === 'custom') {
                                    // Custom role - set roleId to 'custom' to track that custom was selected, set role to empty string
                                    newAssignments[index] = {
                                      ...assignment,
                                      roleId: 'custom',
                                      role: '',
                                    }
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
                                  { value: '', label: 'Select role' },
                                  { value: 'custom', label: 'Custom...' },
                                  ...jobRoles.map(r => ({ value: r.id, label: r.title })),
                                ]}
                              />
                            ) : null}
                            {(jobRoles.length === 0 || assignment.roleId === 'custom') && (
                              <TextField
                                type="text"
                                value={assignment.role || ''}
                                onChange={e => {
                                  const newAssignments = [...assignments]
                                  // Keep roleId as 'custom' when typing to prevent input from unmounting
                                  newAssignments[index] = {
                                    ...assignment,
                                    role: e.target.value,
                                    roleId: 'custom',
                                  }
                                  setAssignments(newAssignments)
                                  setValue('assignedTo', newAssignments)
                                }}
                                placeholder="e.g., Lead, Assistant"
                                className="mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-muted">
                              Pay Type
                            </label>
                            <SelectField
                              aria-label="Pay Type"
                              value={assignment.payType || 'job'}
                              onChange={e => {
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
                              <label className="mb-1 block text-xs font-medium text-ink-muted">
                                Hourly Rate
                              </label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">
                                  $
                                </span>
                                <TextField
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={assignment.hourlyRate ?? ''}
                                  onChange={e => {
                                    const newAssignments = [...assignments]
                                    const hourlyRateValue =
                                      e.target.value === '' ? null : parseFloat(e.target.value)
                                    newAssignments[index] = {
                                      ...assignment,
                                      hourlyRate: isNaN(hourlyRateValue as number)
                                        ? null
                                        : hourlyRateValue,
                                    }
                                    setAssignments(newAssignments)
                                    setValue('assignedTo', newAssignments)
                                  }}
                                  placeholder="0.00"
                                  className="pl-7 font-mono tabular-nums"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-ink-muted">
                                Price
                              </label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">
                                  $
                                </span>
                                <TextField
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={assignment.price ?? ''}
                                  onChange={e => {
                                    const newAssignments = [...assignments]
                                    const priceValue =
                                      e.target.value === '' ? null : parseFloat(e.target.value)
                                    newAssignments[index] = {
                                      ...assignment,
                                      price: isNaN(priceValue as number) ? null : priceValue,
                                    }
                                    setAssignments(newAssignments)
                                    setValue('assignedTo', newAssignments)
                                  }}
                                  placeholder="0.00"
                                  className="pl-7 font-mono tabular-nums"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <AppButton
                          type="button"
                          variant="dangerGhost"
                          size="sm"
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
                          className="mt-3 sm:mt-0 sm:self-start"
                        >
                          Remove
                        </AppButton>
                      </div>
                    </div>
                  )
                })}
                <AppButton
                  type="button"
                  variant="subtle"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    const newAssignments = [
                      ...assignments,
                      {
                        userId: '',
                        role: undefined,
                        roleId: undefined,
                        price: null,
                        payType: 'job' as const,
                        hourlyRate: null,
                      },
                    ]
                    setAssignments(newAssignments)
                    setValue('assignedTo', newAssignments)
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Another Team Member
                </AppButton>
              </>
            )}
          </div>
          {errors.assignedTo && (
            <p className="mt-1.5 text-[13px] text-danger">{errors.assignedTo.message}</p>
          )}
        </div>
      )}
      {submitError && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          {submitError}
        </Alert>
      )}
      <div className="flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row">
        <AppButton type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </AppButton>
        <AppButton type="submit" disabled={isLoading} isLoading={isLoading}>
          {isLoading ? 'Saving...' : jobLog ? 'Update' : 'Create'}
        </AppButton>
      </div>

      <PayChangeEffectiveDateModal
        isOpen={showPayChangeModal}
        onClose={() => {
          setShowPayChangeModal(false)
          setPendingFormData(null)
        }}
        onConfirm={handlePayChangeModalConfirm}
        isLoading={isLoading}
      />
    </form>
  )
}

export default JobLogForm
