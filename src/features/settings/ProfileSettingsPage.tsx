import { useState, useEffect } from 'react'
import { Card, Button, Input } from '@/components/ui'
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
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-primary-light tracking-tight">
          <span className="text-primary-gold">Profile</span>
        </h1>
        <p className="text-primary-light/60 mt-1">
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

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-primary-light mb-4">Personal Information</h2>
          <div className="space-y-4 max-w-2xl">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
            <Input
              label="Email"
              type="email"
              value={user?.email ?? ''}
              disabled
              helperText="Email cannot be changed. Contact your admin if you need to update it."
            />
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
