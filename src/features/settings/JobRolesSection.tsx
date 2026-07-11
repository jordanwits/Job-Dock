import { useState, useEffect } from 'react'
import { Modal, ConfirmationDialog } from '@/components/ui'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import {
  AppButton,
  Panel,
  SettingsSection,
  TextField,
  SelectField,
  StatusBadge,
  EmptyState,
  Alert,
  AlertIcon,
} from './settingsUi'

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
        <h2 className="text-lg font-semibold tracking-tight text-ink">Job Roles</h2>
        <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
      </div>
    )
  }

  return (
    <SettingsSection
      title="Job Roles"
      description="Create custom roles for team members assigned to jobs. Set permissions for clocking in and editing time entries."
      action={
        <AppButton variant="primary" onClick={handleOpenCreate}>
          Create Role
        </AppButton>
      }
    >
      {error && !editModalOpen && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          {error}
        </Alert>
      )}

      {roles.length === 0 ? (
        <Panel>
          <EmptyState
            title="No job roles created yet"
            action={
              <AppButton variant="primary" onClick={handleOpenCreate}>
                Create your first role
              </AppButton>
            }
          />
        </Panel>
      ) : (
        <Panel className="divide-y divide-line">
          {roles.map(role => (
            <div
              key={role.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <h3 className="mb-2 font-medium text-ink">{role.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-muted">Clock in:</span>
                    <StatusBadge tone="neutral">
                      {getPermissionLabel(role.permissions?.canClockInFor || 'self')}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-muted">Edit entries:</span>
                    <StatusBadge tone="neutral">
                      {getPermissionLabel(role.permissions?.canEditTimeEntriesFor || 'self')}
                    </StatusBadge>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <AppButton variant="subtle" size="sm" onClick={() => handleOpenEdit(role)}>
                  Edit
                </AppButton>
                <AppButton variant="dangerGhost" size="sm" onClick={() => setDeleteId(role.id)}>
                  Delete
                </AppButton>
              </div>
            </div>
          ))}
        </Panel>
      )}

      <Modal
        isOpen={editModalOpen}
        onClose={handleCloseModal}
        title={editingRole ? 'Edit Job Role' : 'Create Job Role'}
        fullScreenOnMobile
      >
        <div className="space-y-4">
          {error && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {error}
            </Alert>
          )}

          <TextField
            label="Role Title"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="e.g., Lead, Assistant, Foreman"
            autoFocus
          />

          <SelectField
            label="Can clock in for"
            value={formCanClockInFor}
            onChange={e =>
              setFormCanClockInFor(e.target.value as 'self' | 'assigned' | 'everyone')
            }
            options={[
              { value: 'self', label: 'Self only' },
              { value: 'assigned', label: 'Assigned to same job' },
              { value: 'everyone', label: 'Everyone' },
            ]}
            helperText="Who can this role clock in on behalf of?"
          />

          <SelectField
            label="Can edit time entries for"
            value={formCanEditTimeEntriesFor}
            onChange={e =>
              setFormCanEditTimeEntriesFor(e.target.value as 'self' | 'assigned' | 'everyone')
            }
            options={[
              { value: 'self', label: 'Self only' },
              { value: 'assigned', label: 'Assigned to same job' },
              { value: 'everyone', label: 'Everyone' },
            ]}
            helperText="Whose time entries can this role edit?"
          />

          <div className="flex gap-3 pt-4">
            <AppButton
              variant="primary"
              onClick={handleSave}
              isLoading={saving}
              fullWidth
              className="flex-1"
            >
              {saving ? 'Saving...' : editingRole ? 'Update' : 'Create'}
            </AppButton>
            <AppButton
              variant="subtle"
              onClick={handleCloseModal}
              disabled={saving}
              fullWidth
              className="flex-1"
            >
              Cancel
            </AppButton>
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
    </SettingsSection>
  )
}
