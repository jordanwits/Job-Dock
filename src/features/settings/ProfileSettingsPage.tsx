import { useState, useEffect } from 'react'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { usersService } from '@/lib/api/services'

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export const ProfileSettingsPage = () => {
  const { user, updateUser } = useAuthStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    const { firstName: f, lastName: l } = parseName(user?.name ?? '')
    setFirstName(f)
    setLastName(l)
  }, [user?.name])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First name is required')
      return
    }
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const updated = await usersService.updateProfile({ name: fullName })
      updateUser({ name: updated.name })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-primary-light tracking-tight">
          <span className="text-primary-gold">Profile</span>
        </h1>
        <p className="text-primary-light/60">
          Edit your personal information
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20">
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      {success && (
        <Card className="bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20">
          <p className="text-green-400">Profile updated successfully</p>
        </Card>
      )}

      <Card>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-light mb-2">
                First name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-primary-light/20 bg-primary-dark-secondary px-4 py-2 text-primary-light placeholder-primary-light/50 focus:border-primary-gold focus:outline-none focus:ring-1 focus:ring-primary-gold"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-light mb-2">
                Last name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-primary-light/20 bg-primary-dark-secondary px-4 py-2 text-primary-light placeholder-primary-light/50 focus:border-primary-gold focus:outline-none focus:ring-1 focus:ring-primary-gold"
                placeholder="Last name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-light mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-lg border border-primary-light/20 bg-primary-dark-secondary px-4 py-2 text-primary-light/70 cursor-not-allowed"
            />
            <p className="text-sm text-primary-light/50 mt-1">
              Email cannot be changed. Contact your admin if you need to update it.
            </p>
          </div>
          <div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
