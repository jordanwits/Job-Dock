import { useState, useEffect } from 'react'
import { Button, Input, Card, Select } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
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

  const handleRoleChange = async (userId: string, role: 'admin' | 'employee') => {
    try {
      await services.users.updateRole(userId, role)
      await loadMembers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update role')
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
            <Card key={m.id} className="relative flex flex-col py-3 px-4 gap-3">
              {/* Role badge in top right */}
              <div className="absolute top-3 right-4">
                <span className="text-xs px-2 py-1 rounded bg-primary-dark/50 text-primary-light/80 capitalize">
                  {m.role}
                </span>
              </div>

              <div className="flex-1 min-w-0 pr-16">
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
                        handleRoleChange(m.id, e.target.value as 'admin' | 'employee')
                      }
                      options={[
                        { value: 'admin', label: 'Admin' },
                        { value: 'employee', label: 'Employee' },
                      ]}
                      className="w-full sm:w-32"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleRemove(m.id, m.name)}
                      className="text-red-400 hover:text-red-300 text-sm w-full sm:w-auto"
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
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
