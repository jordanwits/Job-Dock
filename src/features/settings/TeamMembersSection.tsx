import { useState, useEffect, useRef } from 'react'
import { Button, Input, Card, Select, Checkbox } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { TEAM_COLORS } from '@/lib/utils/teamColors'
import { JobRolesSection } from './JobRolesSection'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  canCreateJobs?: boolean
  canScheduleAppointments?: boolean
  canSeeOtherJobs?: boolean
  canSeeJobPrices?: boolean
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

  const loadMembers = async () => {
    try {
      const data = await services.users.getAll()
      setMembers(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load team members')
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, billingData] = await Promise.all([
          services.users.getAll(),
          services.billing.getStatus(),
        ])
        setMembers(usersData)
        setCanInvite(!!billingData.canInviteTeamMembers)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load')
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
      setError(err.response?.data?.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: string, role: 'admin' | 'employee', member?: TeamMember) => {
    try {
      // Preserve existing permissions when changing role
      const permissions = member ? {
        canCreateJobs: member.canCreateJobs ?? true,
        canScheduleAppointments: member.canScheduleAppointments ?? true,
        canSeeOtherJobs: member.canSeeOtherJobs ?? false,
        canSeeJobPrices: member.canSeeJobPrices ?? true,
      } : undefined
      await services.users.updateRole(userId, role, permissions)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update role')
    }
  }

  const handlePermissionChange = async (
    userId: string,
    permission: 'canCreateJobs' | 'canScheduleAppointments' | 'canSeeOtherJobs' | 'canSeeJobPrices',
    value: boolean,
    currentRole: string
  ) => {
    try {
      setUpdatingPermissions(userId)
      setError(null)
      const member = members.find(m => m.id === userId)
      if (!member) return
      
      const permissions = {
        canCreateJobs: permission === 'canCreateJobs' ? value : (member.canCreateJobs ?? true),
        canScheduleAppointments: permission === 'canScheduleAppointments' ? value : (member.canScheduleAppointments ?? true),
        canSeeOtherJobs: permission === 'canSeeOtherJobs' ? value : (member.canSeeOtherJobs ?? false),
        canSeeJobPrices: permission === 'canSeeJobPrices' ? value : (member.canSeeJobPrices ?? true),
      }
      
      await services.users.updateRole(userId, currentRole as 'admin' | 'employee', permissions)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update permission')
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
      setError(err.response?.data?.message || 'Failed to remove member')
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
      setError(err.response?.data?.message || 'Failed to update color')
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
      setError(err.response?.data?.message || 'Failed to update name')
    } finally {
      setOwnerSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-primary-light">Team Members</h2>
        <div className="h-20 bg-primary-dark rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-light">Team Members</h2>
      <div className="space-y-4">
        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {!canInvite ? (
          <p className="text-primary-light/70 text-sm">
            Upgrade to the Team plan to invite team members. Admins have full access; employees can track hours and add notes on jobs.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <p className="text-primary-light/70 text-sm flex-1">
              Invite team members to collaborate. Admins have full access; employees can track hours and add notes on jobs.
            </p>
            <Button variant="primary" onClick={() => setInviteModal(true)} className="w-full sm:w-auto flex-shrink-0">
              Invite team member
            </Button>
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
            <Card key={m.id} className="relative flex flex-col py-4 px-4 gap-4">
              {/* Role badge in top right */}
              <div className="absolute top-4 right-4">
                <span className="text-xs px-2 py-1 rounded bg-primary-dark/50 text-primary-light/80 capitalize">
                  {m.role}
                </span>
              </div>

              <div className="flex-1 min-w-0 pr-20">
                {isEditingOwnerName ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="First name"
                        value={ownerEditFirstName}
                        onChange={(e) => setOwnerEditFirstName(e.target.value)}
                        placeholder="Your first name"
                        className="text-sm"
                      />
                      <Input
                        label="Last name"
                        value={ownerEditLastName}
                        onChange={(e) => setOwnerEditLastName(e.target.value)}
                        placeholder="Last name"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={handleOwnerNameSave} disabled={ownerSaving}>
                        {ownerSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={cancelOwnerNameEdit} disabled={ownerSaving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-primary-light">{m.name || 'Owner'}</p>
                      {/* Color indicator */}
                      {m.color && (
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            m.color.startsWith('#') 
                              ? '' 
                              : (TEAM_COLORS.find(c => c.value === m.color)?.border || 'border-gray-500')
                          } ${
                            m.color.startsWith('#')
                              ? ''
                              : (TEAM_COLORS.find(c => c.value === m.color)?.bg || 'bg-gray-500/20')
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
                    <p className="text-sm text-primary-light/60">{m.email}</p>
                  </>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                {isCurrentUserOwner && !isEditingOwnerName && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startOwnerNameEdit(m)}
                    className="text-primary-gold hover:text-primary-gold/80 text-sm w-full sm:w-auto"
                  >
                    Edit name
                  </Button>
                )}
                {/* Color picker button - available for all users */}
                {canInvite && !isEditingOwnerName && editingColorUserId !== m.id && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingColorUserId(m.id)
                    }}
                    className="text-sm w-full sm:w-auto"
                    disabled={updatingColor === m.id}
                  >
                    Set Color
                  </Button>
                )}
                {m.role !== 'owner' && canInvite && (
                  <>
                    <Select
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedMemberId(expandedMemberId === m.id ? null : m.id)}
                      className="text-sm w-full sm:w-auto"
                      disabled={updatingPermissions === m.id}
                    >
                      {expandedMemberId === m.id ? 'Hide Permissions' : 'Permissions'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRemove(m.id, m.name)}
                      className="text-red-400 hover:text-red-300 text-sm w-full sm:w-auto"
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
              
              {/* Permissions Section */}
              {m.role !== 'owner' && canInvite && expandedMemberId === m.id && (
                <div className="mt-2 pt-4 border-t border-primary-blue/30 bg-primary-dark/30 rounded-lg p-4 -mx-4 -mb-4">
                  <p className="text-sm font-semibold text-primary-light mb-3">Permissions</p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="mt-0.5 flex-shrink-0">
                        <Checkbox
                          checked={m.canCreateJobs ?? true}
                          onChange={(e) => handlePermissionChange(m.id, 'canCreateJobs', e.target.checked, m.role)}
                          disabled={updatingPermissions === m.id}
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm text-primary-light/90 block">Can create jobs</span>
                        <span className="text-xs text-primary-light/50 mt-0.5 block">Allow this team member to create new jobs</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="mt-0.5 flex-shrink-0">
                        <Checkbox
                          checked={m.canScheduleAppointments ?? true}
                          onChange={(e) => handlePermissionChange(m.id, 'canScheduleAppointments', e.target.checked, m.role)}
                          disabled={updatingPermissions === m.id}
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm text-primary-light/90 block">Can schedule appointments</span>
                        <span className="text-xs text-primary-light/50 mt-0.5 block">Allow this team member to set start and end times for jobs</span>
                      </div>
                    </label>
                    {m.role === 'employee' && (
                      <>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="mt-0.5 flex-shrink-0">
                            <Checkbox
                              checked={m.canSeeOtherJobs ?? false}
                              onChange={(e) => handlePermissionChange(m.id, 'canSeeOtherJobs', e.target.checked, m.role)}
                              disabled={updatingPermissions === m.id}
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm text-primary-light/90 block">Can see other people's jobs</span>
                            <span className="text-xs text-primary-light/50 mt-0.5 block">Allow this team member to see, edit, and delete jobs created by others</span>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="mt-0.5 flex-shrink-0">
                            <Checkbox
                              checked={m.canSeeJobPrices ?? true}
                              onChange={(e) => handlePermissionChange(m.id, 'canSeeJobPrices', e.target.checked, m.role)}
                              disabled={updatingPermissions === m.id}
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm text-primary-light/90 block">Can see job prices</span>
                            <span className="text-xs text-primary-light/50 mt-0.5 block">Allow this team member to see job prices and assignment prices</span>
                          </div>
                        </label>
                      </>
                    )}
                    {m.role === 'admin' && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 border-primary-blue bg-primary-dark-secondary flex items-center justify-center">
                          <svg className="w-3 h-3 text-primary-gold" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-primary-light/90 block">Can see other people's jobs</span>
                          <span className="text-xs text-primary-light/50 mt-0.5 block italic">Admins can see all jobs by default</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Color Picker Section */}
              {canInvite && editingColorUserId === m.id && (
                <div 
                  ref={colorPickerSectionRef}
                  className="mt-2 pt-4 border-t border-primary-blue/30 bg-primary-dark/30 rounded-lg p-4 -mx-4 -mb-4 color-picker-container"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold text-primary-light mb-3">Calendar Color</p>
                  <p className="text-xs text-primary-light/50 mb-4">
                    Choose a color to identify this team member in the calendar view.
                  </p>
                  
                  {/* Preset Colors */}
                  <div className="mb-4" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <p className="text-xs text-primary-light/70 mb-2">Preset Colors</p>
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
                              ${isSelected ? 'ring-2 ring-primary-gold ring-offset-2 ring-offset-primary-dark' : ''}
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
                        className={`
                          w-10 h-10 rounded-lg border-2 border-dashed border-primary-light/30
                          bg-primary-dark-secondary hover:bg-primary-dark
                          ${pendingColorValue === null ? 'ring-2 ring-primary-gold ring-offset-2 ring-offset-primary-dark' : ''}
                          hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed
                          flex items-center justify-center
                        `}
                        title="Use default (auto-assigned)"
                      >
                        <span className="text-xs text-primary-light/50">Auto</span>
                      </button>
                    </div>
                  </div>

                  {/* Custom Color Picker */}
                  <div className="mb-4" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <p className="text-xs text-primary-light/70 mb-2">Custom Color</p>
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
                          className="w-16 h-10 rounded-lg border-2 border-primary-blue/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
                          style={{
                            backgroundColor: pendingColorValue && pendingColorValue.startsWith('#') ? pendingColorValue : (customColorValue || '#3b82f6'),
                          }}
                        />
                        {pendingColorValue && pendingColorValue.startsWith('#') && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-gold ring-2 ring-primary-dark pointer-events-none" />
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
                          className="w-full h-10 rounded-lg border border-primary-blue/30 bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-primary-gold disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-primary-light/50 mt-1">
                      Enter a hex color code (e.g., #FF5733) or use the color picker
                    </p>
                  </div>

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-primary-blue/20">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCancelColor()
                      }}
                      disabled={updatingColor === m.id}
                      className="text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSaveColor()
                      }}
                      disabled={updatingColor === m.id}
                      isLoading={updatingColor === m.id}
                      className="text-sm"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            )
          })}
        </div>

        {inviteModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6 space-y-4">
              <h3 className="text-xl font-semibold text-primary-light">Invite team member</h3>
              <Input
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="Jane"
                />
                <Input
                  label="Last name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
              <Select
                label="Role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'employee')}
                options={[
                  { value: 'admin', label: 'Admin (full access)' },
                  { value: 'employee', label: 'Employee (jobs, hours, photos, notes)' },
                ]}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setInviteModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleInvite} disabled={inviting}>
                  {inviting ? 'Sending...' : 'Send invite'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Job Roles Section */}
      <div className="mt-8 pt-8 border-t border-primary-blue/30">
        <JobRolesSection />
      </div>
    </div>
  )
}
