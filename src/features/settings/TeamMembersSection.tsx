import { useState, useEffect } from 'react'
import { Button, Input, Card, Select } from '@/components/ui'
import { CollapsibleSection } from './CollapsibleSection'
import { services } from '@/lib/api/services'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

export const TeamMembersSection = () => {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [canInvite, setCanInvite] = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setError('Email and name are required')
      return
    }
    try {
      setInviting(true)
      setError(null)
      await services.users.invite({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
      })
      setInviteModal(false)
      setInviteEmail('')
      setInviteName('')
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

  if (loading) {
    return (
      <CollapsibleSection title="Team Members" defaultCollapsed={false}>
        <div className="h-20 bg-primary-dark rounded-lg animate-pulse" />
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title="Team Members" defaultCollapsed={false}>
      <div className="space-y-4">
        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {!canInvite ? (
          <p className="text-primary-light/70 text-sm">
            Upgrade to the Team plan to invite team members. Admins have full access; employees can track hours and add notes on jobs.
          </p>
        ) : (
          <div className="flex justify-between items-center">
            <p className="text-primary-light/70 text-sm">
              Invite team members to collaborate. Admins have full access; employees can track hours and add notes on jobs.
            </p>
            <Button variant="primary" onClick={() => setInviteModal(true)}>
              Invite team member
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="flex items-center justify-between py-3 px-4">
              <div>
                <p className="font-medium text-primary-light">{m.name}</p>
                <p className="text-sm text-primary-light/60">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded bg-primary-dark/50 text-primary-light/80 capitalize">
                  {m.role}
                </span>
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
                      className="w-32"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleRemove(m.id, m.name)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
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
              <Input
                label="Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
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
    </CollapsibleSection>
  )
}
