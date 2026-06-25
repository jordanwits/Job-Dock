import { useState, useEffect, useRef } from 'react'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { TEAM_COLORS } from '@/lib/utils/teamColors'
import { JobRolesSection } from './JobRolesSection'
import { cn } from '@/lib/utils'
import {
  AppButton,
  Panel,
  TextField,
  SelectField,
  CheckboxField,
  StatusBadge,
  Alert,
  Avatar,
  CheckIcon,
  AlertIcon,
} from './settingsUi'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  canCreateJobs?: boolean
  canScheduleAppointments?: boolean
  canSeeOtherJobs?: boolean
  canSeeJobPrices?: boolean
  canEditJobs?: boolean
  canEditAssignedJobsOnly?: boolean
  color?: string | null
  createdAt: string
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export const TeamMembersSection = () => {
  const { user, updateUser } = useAuthStore()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [canInvite, setCanInvite] = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownerEditUserId, setOwnerEditUserId] = useState<string | null>(null)
  const [ownerEditFirstName, setOwnerEditFirstName] = useState('')
  const [ownerEditLastName, setOwnerEditLastName] = useState('')
  const [ownerSaving, setOwnerSaving] = useState(false)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [updatingPermissions, setUpdatingPermissions] = useState<string | null>(null)
  const [editingColorUserId, setEditingColorUserId] = useState<string | null>(null)
  const [updatingColor, setUpdatingColor] = useState<string | null>(null)
  const [customColorValue, setCustomColorValue] = useState<string>('#3b82f6')
  const [pendingColorValue, setPendingColorValue] = useState<string | null>(null)
  const colorPickerSectionRef = useRef<HTMLDivElement>(null)

  // Initialize custom color value when opening color picker
  useEffect(() => {
    if (editingColorUserId) {
      const member = members.find(m => m.id === editingColorUserId)
      if (member) {
        setPendingColorValue(member.color || null)
        if (member.color && member.color.startsWith('#')) {
          setCustomColorValue(member.color)
        } else {
          setCustomColorValue('#3b82f6')
        }
      }
    }
  }, [editingColorUserId, members])

  // Handle clicks outside color picker section to close it
  useEffect(() => {
    if (editingColorUserId) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (colorPickerSectionRef.current && !colorPickerSectionRef.current.contains(target)) {
          // Don't close if clicking on the "Set Color" button
          if (target.closest('button') && target.textContent?.includes('Set Color')) {
            return
          }
          setEditingColorUserId(null)
          setPendingColorValue(null)
        }
      }

      // Use a small delay to avoid immediate closing when opening
      const timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)

      return () => {
        clearTimeout(timeout)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [editingColorUserId])

  const [teamLimitReached, setTeamLimitReached] = useState(false)
  const [teamMemberCount, setTeamMemberCount] = useState<number | null>(null)
  const [teamMemberLimit, setTeamMemberLimit] = useState<number | null>(null)

  const loadMembers = async () => {
    try {
      const [usersData, billingData] = await Promise.all([
        services.users.getAll(),
        services.billing.getStatus(),
      ])
      setMembers(usersData)
      const canInviteMembers = !!billingData.canInviteTeamMembers
      const canInviteMore = billingData.canInviteMore !== false
      setCanInvite(canInviteMembers && canInviteMore)
      setTeamLimitReached(canInviteMembers && !canInviteMore)
      setTeamMemberCount(billingData.teamMemberCount ?? null)
      setTeamMemberLimit(billingData.teamMemberLimit ?? null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load team members')
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        await loadMembers()
      } catch (err: any) {
        setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteFirstName.trim()) {
      setError('Email and first name are required')
      return
    }
    const fullName = [inviteFirstName.trim(), inviteLastName.trim()].filter(Boolean).join(' ')
    try {
      setInviting(true)
      setError(null)
      await services.users.invite({
        email: inviteEmail.trim(),
        name: fullName,
        role: inviteRole,
      })
      setInviteModal(false)
      setInviteEmail('')
      setInviteFirstName('')
      setInviteLastName('')
      setInviteRole('employee')
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: string, role: 'admin' | 'employee', member?: TeamMember) => {
    try {
      // Preserve existing permissions when changing role
      const permissions = member ? {
        canCreateJobs: member.canCreateJobs ?? false,
        canScheduleAppointments: member.canScheduleAppointments ?? false,
        canSeeOtherJobs: member.canSeeOtherJobs ?? false,
        canSeeJobPrices: member.canSeeJobPrices ?? false,
        canEditJobs: member.canEditJobs ?? false,
        canEditAssignedJobsOnly: member.canEditAssignedJobsOnly ?? false,
      } : undefined
      await services.users.updateRole(userId, role, permissions)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update role')
    }
  }

  const handlePermissionChange = async (
    userId: string,
    permission: 'canCreateJobs' | 'canScheduleAppointments' | 'canSeeOtherJobs' | 'canSeeJobPrices' | 'canEditJobs' | 'canEditAssignedJobsOnly',
    value: boolean,
    currentRole: string
  ) => {
    try {
      setUpdatingPermissions(userId)
      setError(null)
      const member = members.find(m => m.id === userId)
      if (!member) return

      const permissions = {
        canCreateJobs: permission === 'canCreateJobs' ? value : (member.canCreateJobs ?? false),
        canScheduleAppointments: permission === 'canScheduleAppointments' ? value : (member.canScheduleAppointments ?? false),
        canSeeOtherJobs: permission === 'canSeeOtherJobs' ? value : (member.canSeeOtherJobs ?? false),
        canSeeJobPrices: permission === 'canSeeJobPrices' ? value : (member.canSeeJobPrices ?? false),
        canEditJobs: permission === 'canEditJobs' ? value : (member.canEditJobs ?? false),
        canEditAssignedJobsOnly: permission === 'canEditAssignedJobsOnly' ? value : (member.canEditAssignedJobsOnly ?? false),
      }

      await services.users.updateRole(userId, currentRole as 'admin' | 'employee', permissions)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update permission')
    } finally {
      setUpdatingPermissions(null)
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the team?`)) return
    try {
      await services.users.remove(userId)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleColorChange = async (userId: string, color: string | null) => {
    try {
      setUpdatingColor(userId)
      setError(null)
      await services.users.updateColor(userId, color)
      await loadMembers()
      setEditingColorUserId(null)
      setPendingColorValue(null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update color')
    } finally {
      setUpdatingColor(null)
    }
  }

  const handleSaveColor = () => {
    if (editingColorUserId) {
      handleColorChange(editingColorUserId, pendingColorValue)
    }
  }

  const handleCancelColor = () => {
    setEditingColorUserId(null)
    setPendingColorValue(null)
  }

  const startOwnerNameEdit = (member: TeamMember) => {
    const { firstName, lastName } = parseName(member.name)
    setOwnerEditUserId(member.id)
    setOwnerEditFirstName(firstName)
    setOwnerEditLastName(lastName)
    setError(null)
  }

  const cancelOwnerNameEdit = () => {
    setOwnerEditUserId(null)
  }

  const handleOwnerNameSave = async () => {
    if (!ownerEditFirstName.trim()) {
      setError('First name is required')
      return
    }
    const fullName = [ownerEditFirstName.trim(), ownerEditLastName.trim()].filter(Boolean).join(' ')
    try {
      setOwnerSaving(true)
      setError(null)
      const updated = await services.users.updateProfile({ name: fullName })
      updateUser({ name: updated.name })
      setOwnerEditUserId(null)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update name')
    } finally {
      setOwnerSaving(false)
    }
  }

  const showTeamCount = teamMemberLimit != null && teamMemberCount != null

  const roleBadgeTone = (role: string): 'accent' | 'info' | 'neutral' => {
    if (role === 'owner') return 'accent'
    if (role === 'admin') return 'info'
    return 'neutral'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Team Members</h2>
        <div className="h-20 rounded-xl bg-surface-2 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Team Members</h2>
        {showTeamCount && (
          <span className="text-sm font-medium font-mono tabular-nums px-2 py-0.5 rounded bg-surface-2 text-ink-muted">
            {teamMemberCount}/{teamMemberLimit}
          </span>
        )}
      </div>
      <div className="space-y-4">
        {error && !inviteModal && (
          <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>{error}</Alert>
        )}

        {!canInvite ? (
          <p className="text-sm text-ink-muted">
            {teamLimitReached
              ? 'Team plan limit reached (5 users). Upgrade to Team+ in Billing to add more members.'
              : 'Upgrade to the Team or Team+ plan to invite team members. Admins have full access; employees can track hours and add notes on jobs.'}
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <p className="text-sm flex-1 text-ink-muted">
              Invite team members to collaborate. Admins have full access; employees can track hours and add notes on jobs.
            </p>
            <AppButton variant="primary" onClick={() => { setError(null); setInviteModal(true) }} className="w-full sm:w-auto flex-shrink-0">
              Invite team member
            </AppButton>
          </div>
        )}

        <div className="space-y-2">
          {[...members].sort((a, b) => {
            // Owner always comes first
            if (a.role === 'owner' && b.role !== 'owner') return -1
            if (a.role !== 'owner' && b.role === 'owner') return 1
            // Otherwise maintain original order
            return 0
          }).map((m) => {
            const isCurrentUserOwner = m.role === 'owner' && m.id === user?.id
            const isEditingOwnerName = ownerEditUserId === m.id

            return (
            <Panel key={m.id} className="relative flex flex-col py-4 px-4 gap-4">
              {/* Role badge in top right */}
              <div className="absolute top-4 right-4">
                <StatusBadge tone={roleBadgeTone(m.role)}>
                  {m.role}
                </StatusBadge>
              </div>

              <div className="flex-1 min-w-0 pr-20">
                {isEditingOwnerName ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        label="First name"
                        value={ownerEditFirstName}
                        onChange={(e) => setOwnerEditFirstName(e.target.value)}
                        placeholder="Your first name"
                      />
                      <TextField
                        label="Last name"
                        value={ownerEditLastName}
                        onChange={(e) => setOwnerEditLastName(e.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                    <div className="flex gap-2">
                      <AppButton variant="primary" size="sm" onClick={handleOwnerNameSave} disabled={ownerSaving} isLoading={ownerSaving}>
                        {ownerSaving ? 'Saving...' : 'Save'}
                      </AppButton>
                      <AppButton variant="subtle" size="sm" onClick={cancelOwnerNameEdit} disabled={ownerSaving}>
                        Cancel
                      </AppButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name || 'Owner'} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-ink">{m.name || 'Owner'}</p>
                        {/* Color indicator */}
                        {m.color && (
                          <div
                            className={`w-4 h-4 rounded-full border-2 ${
                              m.color.startsWith('#')
                                ? ''
                                : (TEAM_COLORS.find(c => c.value === m.color)?.border || 'border-line-strong')
                            } ${
                              m.color.startsWith('#')
                                ? ''
                                : (TEAM_COLORS.find(c => c.value === m.color)?.bg || 'bg-surface-2')
                            }`}
                            style={m.color.startsWith('#') ? {
                              backgroundColor: m.color,
                              borderColor: m.color,
                              opacity: 0.8,
                            } : undefined}
                            title={`Calendar color: ${m.color}`}
                          />
                        )}
                      </div>
                      <p className="text-sm text-ink-muted">{m.email}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                {isCurrentUserOwner && !isEditingOwnerName && (
                  <AppButton
                    variant="subtle"
                    size="sm"
                    onClick={() => startOwnerNameEdit(m)}
                    className="w-full sm:w-auto"
                  >
                    Edit name
                  </AppButton>
                )}
                {/* Color picker button - available for all users */}
                {canInvite && !isEditingOwnerName && editingColorUserId !== m.id && (
                  <AppButton
                    variant="subtle"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingColorUserId(m.id)
                    }}
                    className="w-full sm:w-auto"
                    disabled={updatingColor === m.id}
                  >
                    Set Color
                  </AppButton>
                )}
                {m.role !== 'owner' && canInvite && (
                  <>
                    <SelectField
                      value={m.role}
                      onChange={(e) =>
                        handleRoleChange(m.id, e.target.value as 'admin' | 'employee', m)
                      }
                      options={[
                        { value: 'admin', label: 'Admin' },
                        { value: 'employee', label: 'Employee' },
                      ]}
                      className="w-full sm:w-32"
                    />
                    <AppButton
                      variant="subtle"
                      size="sm"
                      onClick={() => setExpandedMemberId(expandedMemberId === m.id ? null : m.id)}
                      className="w-full sm:w-auto"
                      disabled={updatingPermissions === m.id}
                    >
                      {expandedMemberId === m.id ? 'Hide Permissions' : 'Permissions'}
                    </AppButton>
                    <AppButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemove(m.id, m.name)}
                      className="w-full sm:w-auto"
                    >
                      Remove
                    </AppButton>
                  </>
                )}
              </div>

              {/* Permissions Section */}
              {m.role !== 'owner' && canInvite && expandedMemberId === m.id && (
                <div className="mt-2 pt-4 border-t border-line rounded-lg p-4 -mx-4 -mb-4 bg-surface-2">
                  <p className="text-sm font-semibold tracking-tight mb-3 text-ink">Permissions</p>
                  <div className="space-y-3">
                    <CheckboxField
                      checked={m.canCreateJobs ?? false}
                      onChange={(checked) => handlePermissionChange(m.id, 'canCreateJobs', checked, m.role)}
                      disabled={updatingPermissions === m.id}
                      label="Can create jobs"
                      description="Allow this team member to create new jobs"
                    />
                    <CheckboxField
                      checked={m.canScheduleAppointments ?? false}
                      onChange={(checked) => handlePermissionChange(m.id, 'canScheduleAppointments', checked, m.role)}
                      disabled={updatingPermissions === m.id}
                      label="Can schedule appointments"
                      description="Allow this team member to set start and end times for jobs"
                    />
                    {m.role === 'employee' && (
                      <>
                        <CheckboxField
                          checked={m.canSeeOtherJobs ?? false}
                          onChange={(checked) => handlePermissionChange(m.id, 'canSeeOtherJobs', checked, m.role)}
                          disabled={updatingPermissions === m.id}
                          label="Can see other people's jobs"
                          description="Allow this team member to see, edit, and delete jobs created by others"
                        />
                        <CheckboxField
                          checked={m.canSeeJobPrices ?? false}
                          onChange={(checked) => handlePermissionChange(m.id, 'canSeeJobPrices', checked, m.role)}
                          disabled={updatingPermissions === m.id}
                          label="Can see job prices"
                          description="Allow this team member to see job prices and assignment prices"
                        />
                        <div>
                          <CheckboxField
                            checked={m.canEditJobs ?? false}
                            onChange={(checked) => handlePermissionChange(m.id, 'canEditJobs', checked, m.role)}
                            disabled={updatingPermissions === m.id}
                            label="Can edit jobs"
                            description="Allow this team member to edit and delete jobs"
                          />
                          {(m.canEditJobs ?? false) && (
                            <div className="ml-8 mt-2">
                              <CheckboxField
                                checked={m.canEditAssignedJobsOnly ?? false}
                                onChange={(checked) => handlePermissionChange(m.id, 'canEditAssignedJobsOnly', checked, m.role)}
                                disabled={updatingPermissions === m.id}
                                label="Assigned jobs only"
                                description="When checked, they can only edit jobs they are assigned to. Uncheck to allow editing all jobs."
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {m.role === 'admin' && (
                      <>
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-md border border-accent-strong bg-accent-strong">
                            <CheckIcon className="h-3.5 w-3.5 text-accent-contrast" />
                          </span>
                          <div className="flex-1">
                            <span className="text-sm block text-ink">Can see other people's jobs</span>
                            <span className="text-[13px] mt-0.5 block italic text-ink-subtle">Admins can see all jobs by default</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-md border border-accent-strong bg-accent-strong">
                            <CheckIcon className="h-3.5 w-3.5 text-accent-contrast" />
                          </span>
                          <div className="flex-1">
                            <span className="text-sm block text-ink">Can edit jobs</span>
                            <span className="text-[13px] mt-0.5 block italic text-ink-subtle">Admins can edit all jobs by default</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Color Picker Section */}
              {canInvite && editingColorUserId === m.id && (
                <div
                  ref={colorPickerSectionRef}
                  className="mt-2 pt-4 border-t border-line rounded-lg p-4 -mx-4 -mb-4 color-picker-container bg-surface-2"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold tracking-tight mb-3 text-ink">Calendar Color</p>
                  <p className="text-[13px] mb-4 text-ink-muted">
                    Choose a color to identify this team member in the calendar view.
                  </p>

                  {/* Preset Colors */}
                  <div className="mb-4" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <p className="text-[13px] mb-2 text-ink-muted">Preset Colors</p>
                    <div className="grid grid-cols-6 gap-2">
                      {TEAM_COLORS.map((color) => {
                        const isSelected = pendingColorValue === color.value
                        return (
                          <button
                            key={color.value}
                            onClick={(e) => {
                              e.stopPropagation()
                              setPendingColorValue(color.value)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={updatingColor === m.id}
                            className={`
                              w-10 h-10 rounded-lg border-2 transition-all
                              ${color.bg} ${color.border}
                              ${isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}
                              hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                            title={color.value}
                          />
                        )
                      })}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingColorValue(null)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        disabled={updatingColor === m.id}
                        className={cn(
                          "w-10 h-10 rounded-lg border-2 border-dashed border-line-strong bg-surface hover:bg-surface-hover hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
                          pendingColorValue === null && 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
                        )}
                        title="Use default (auto-assigned)"
                      >
                        <span className="text-[13px] text-ink-muted">Auto</span>
                      </button>
                    </div>
                  </div>

                  {/* Custom Color Picker */}
                  <div className="mb-4" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <p className="text-[13px] mb-2 text-ink-muted">Custom Color</p>
                    <div className="flex items-center gap-3">
                      <div className="relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <input
                          type="color"
                          value={pendingColorValue && pendingColorValue.startsWith('#') ? pendingColorValue : (customColorValue || '#3b82f6')}
                          onChange={(e) => {
                            e.stopPropagation()
                            const hexColor = e.target.value.toUpperCase()
                            setCustomColorValue(hexColor)
                            setPendingColorValue(hexColor)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={updatingColor === m.id}
                          className="w-16 h-10 rounded-lg border-2 border-line cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
                          style={{
                            backgroundColor: pendingColorValue && pendingColorValue.startsWith('#') ? pendingColorValue : (customColorValue || '#3b82f6'),
                          }}
                        />
                        {pendingColorValue && pendingColorValue.startsWith('#') && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent ring-2 ring-surface pointer-events-none" />
                        )}
                      </div>
                      <div className="flex-1" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={pendingColorValue && pendingColorValue.startsWith('#') ? pendingColorValue : (pendingColorValue || customColorValue || '#3b82f6')}
                          onChange={(e) => {
                            e.stopPropagation()
                            const value = e.target.value.toUpperCase()
                            setCustomColorValue(value)
                            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                              setPendingColorValue(value)
                            } else if (value === '' || value === '#') {
                              setPendingColorValue(value)
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={updatingColor === m.id}
                          placeholder="#000000"
                          maxLength={7}
                          className="w-full h-10 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-50 disabled:cursor-not-allowed font-mono tabular-nums"
                        />
                      </div>
                    </div>
                    <p className="text-[13px] mt-1 text-ink-subtle">
                      Enter a hex color code (e.g., #FF5733) or use the color picker
                    </p>
                  </div>

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-line">
                    <AppButton
                      variant="subtle"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCancelColor()
                      }}
                      disabled={updatingColor === m.id}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSaveColor()
                      }}
                      disabled={updatingColor === m.id}
                      isLoading={updatingColor === m.id}
                    >
                      Save
                    </AppButton>
                  </div>
                </div>
              )}
            </Panel>
            )
          })}
        </div>

        {inviteModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <Panel className="w-full max-w-md p-6 space-y-4">
              <h3 className="text-lg font-semibold tracking-tight text-ink">Invite team member</h3>
              <TextField
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="First name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="Jane"
                />
                <TextField
                  label="Last name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
              <SelectField
                label="Role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'employee')}
                options={[
                  { value: 'admin', label: 'Admin (full access)' },
                  { value: 'employee', label: 'Employee (jobs, hours, photos, notes)' },
                ]}
              />
              {error && (
                <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>{error}</Alert>
              )}
              <div className="flex gap-2 justify-end">
                <AppButton
                  variant="subtle"
                  onClick={() => {
                    setError(null)
                    setInviteModal(false)
                  }}
                >
                  Cancel
                </AppButton>
                <AppButton variant="primary" onClick={handleInvite} disabled={inviting} isLoading={inviting}>
                  {inviting ? 'Sending...' : 'Send invite'}
                </AppButton>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* Job Roles Section */}
      <div className="mt-8 pt-8 border-t border-line">
        <JobRolesSection />
      </div>
    </div>
  )
}
