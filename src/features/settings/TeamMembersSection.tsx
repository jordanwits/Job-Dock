import { useState, useEffect } from 'react'
import { Button, Input, Card, Select, Checkbox } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  canCreateJobs?: boolean
  canScheduleAppointments?: boolean
  canEditAllAppointments?: boolean
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
        canEditAllAppointments: member.canEditAllAppointments ?? false,
      } : undefined
      await services.users.updateRole(userId, role, permissions)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update role')
    }
  }

  const handlePermissionChange = async (
    userId: string,
    permission: 'canCreateJobs' | 'canScheduleAppointments' | 'canEditAllAppointments',
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
        canEditAllAppointments: permission === 'canEditAllAppointments' ? value : (member.canEditAllAppointments ?? false),
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
          {members.map((m) => {
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
                    <p className="font-medium text-primary-light">{m.name || 'Owner'}</p>
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
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="mt-0.5 flex-shrink-0">
                          <Checkbox
                            checked={m.canEditAllAppointments ?? false}
                            onChange={(e) => handlePermissionChange(m.id, 'canEditAllAppointments', e.target.checked, m.role)}
                            disabled={updatingPermissions === m.id}
                          />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-primary-light/90 block">Can edit all appointments</span>
                          <span className="text-xs text-primary-light/50 mt-0.5 block">Allow this team member to edit and delete appointments created by others</span>
                        </div>
                      </label>
                    )}
                    {m.role === 'admin' && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 border-primary-blue bg-primary-dark-secondary flex items-center justify-center">
                          <svg className="w-3 h-3 text-primary-gold" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-primary-light/90 block">Can edit all appointments</span>
                          <span className="text-xs text-primary-light/50 mt-0.5 block italic">Admins can edit all appointments by default</span>
                        </div>
                      </div>
                    )}
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
    </div>
  )
}
