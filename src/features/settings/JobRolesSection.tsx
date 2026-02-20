import { useState, useEffect } from 'react'
import { Button, Input, Card, Select, Modal, ConfirmationDialog } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'

interface JobRole {
  id: string
  title: string
  sortOrder: number
  permissions?: {
    canClockInFor?: 'self' | 'assigned' | 'everyone'
    canEditTimeEntriesFor?: 'self' | 'assigned' | 'everyone'
  }
  createdAt: string
  updatedAt: string
}

export const JobRolesSection = () => {
  const { user } = useAuthStore()
  const [roles, setRoles] = useState<JobRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<JobRole | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formCanClockInFor, setFormCanClockInFor] = useState<'self' | 'assigned' | 'everyone'>(
    'self'
  )
  const [formCanEditTimeEntriesFor, setFormCanEditTimeEntriesFor] = useState<
    'self' | 'assigned' | 'everyone'
  >('self')
  const [saving, setSaving] = useState(false)

  const loadRoles = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await services.jobRoles.getAll()
      setRoles(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load job roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const handleOpenCreate = () => {
    setEditingRole(null)
    setFormTitle('')
    setFormCanClockInFor('self')
    setFormCanEditTimeEntriesFor('self')
    setError(null)
    setEditModalOpen(true)
  }

  const handleOpenEdit = (role: JobRole) => {
    setEditingRole(role)
    setFormTitle(role.title)
    setFormCanClockInFor(role.permissions?.canClockInFor || 'self')
    setFormCanEditTimeEntriesFor(role.permissions?.canEditTimeEntriesFor || 'self')
    setError(null)
    setEditModalOpen(true)
  }

  const handleCloseModal = () => {
    setEditModalOpen(false)
    setEditingRole(null)
    setFormTitle('')
    setFormCanClockInFor('self')
    setFormCanEditTimeEntriesFor('self')
    setError(null)
  }

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setError('Role title is required')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const permissions = {
        canClockInFor: formCanClockInFor,
        canEditTimeEntriesFor: formCanEditTimeEntriesFor,
      }

      if (editingRole) {
        await services.jobRoles.update(editingRole.id, {
          title: formTitle.trim(),
          permissions,
        })
      } else {
        await services.jobRoles.create({
          title: formTitle.trim(),
          permissions,
        })
      }
      await loadRoles()
      handleCloseModal()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save job role')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setError(null)
      await services.jobRoles.delete(deleteId)
      await loadRoles()
      setDeleteId(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete job role')
      setDeleteId(null)
    }
  }

  const getPermissionLabel = (value: 'self' | 'assigned' | 'everyone') => {
    switch (value) {
      case 'self':
        return 'Self only'
      case 'assigned':
        return 'Assigned to same job'
      case 'everyone':
        return 'Everyone'
      default:
        return value
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-primary-light">Job Roles</h2>
        <div className="h-20 bg-primary-dark rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-primary-light">Job Roles</h2>
          <p className="text-sm text-primary-light/70 mt-1">
            Create custom roles for team members assigned to jobs. Set permissions for clocking in
            and editing time entries.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreate}
          className="w-full sm:w-auto flex-shrink-0"
        >
          Create Role
        </Button>
      </div>

      {error && !editModalOpen && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {roles.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-primary-light/70 mb-4">No job roles created yet</p>
          <Button variant="primary" onClick={handleOpenCreate}>
            Create your first role
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {roles.map(role => (
            <Card key={role.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-primary-light mb-2">{role.title}</h3>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-primary-light/60">Clock in:</span>
                      <span className="px-2 py-0.5 rounded bg-primary-dark text-primary-light/80 text-xs">
                        {getPermissionLabel(role.permissions?.canClockInFor || 'self')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-primary-light/60">Edit entries:</span>
                      <span className="px-2 py-0.5 rounded bg-primary-dark text-primary-light/80 text-xs">
                        {getPermissionLabel(role.permissions?.canEditTimeEntriesFor || 'self')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(role)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => setDeleteId(role.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={editModalOpen}
        onClose={handleCloseModal}
        title={editingRole ? 'Edit Job Role' : 'Create Job Role'}
      >
        <div className="space-y-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {error}
            </div>
          )}

          <Input
            label="Role Title"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="e.g., Lead, Assistant, Foreman"
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-primary-light/70 mb-2">
              Can clock in for
            </label>
            <Select
              value={formCanClockInFor}
              onChange={e =>
                setFormCanClockInFor(e.target.value as 'self' | 'assigned' | 'everyone')
              }
              options={[
                { value: 'self', label: 'Self only' },
                { value: 'assigned', label: 'Assigned to same job' },
                { value: 'everyone', label: 'Everyone' },
              ]}
            />
            <p className="text-xs text-primary-light/60 mt-1">
              Who can this role clock in on behalf of?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-light/70 mb-2">
              Can edit time entries for
            </label>
            <Select
              value={formCanEditTimeEntriesFor}
              onChange={e =>
                setFormCanEditTimeEntriesFor(e.target.value as 'self' | 'assigned' | 'everyone')
              }
              options={[
                { value: 'self', label: 'Self only' },
                { value: 'assigned', label: 'Assigned to same job' },
                { value: 'everyone', label: 'Everyone' },
              ]}
            />
            <p className="text-xs text-primary-light/60 mt-1">
              Whose time entries can this role edit?
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : editingRole ? 'Update' : 'Create'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCloseModal}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Job Role"
        message={`Are you sure you want to delete "${roles.find(r => r.id === deleteId)?.title}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
