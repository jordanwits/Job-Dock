import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { usersService } from '@/lib/api/services'
import { GoogleCalendarSection } from './GoogleCalendarSection'
import {
  AppButton,
  TextField,
  Alert,
  AlertIcon,
  CheckCircleIcon,
  SettingsSection,
} from './settingsUi'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // Error carried back from the Google Calendar OAuth callback (?googleError=…).
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null)

  useEffect(() => {
    const { firstName: f, lastName: l } = parseName(user?.name ?? '')
    setFirstName(f)
    setLastName(l)
  }, [user?.name])

  // Handle return from the Google Calendar OAuth callback (employees land here) —
  // capture any error to show inside the section, then clear the query params.
  // Mirrors the ?tab=google-calendar handling in SettingsPage.
  useEffect(() => {
    const googleError = searchParams.get('googleError')
    const googleConnected = searchParams.get('googleConnected')
    if (googleError || googleConnected === '1') {
      setGoogleConnectError(googleError)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

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
    <div className="mx-auto max-w-2xl space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile</h1>
        <p className="mt-1 text-sm text-ink-muted">Edit your personal information</p>
      </div>

      {error && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />} onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert tone="success" icon={<CheckCircleIcon className="h-4 w-4" />}>
          Profile updated successfully
        </Alert>
      )}

      <SettingsSection title="Personal information">
        <div className="space-y-4">
          <TextField
            label="First name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="First name"
          />
          <TextField
            label="Last name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Last name"
          />
          <TextField
            label="Email"
            type="email"
            value={user?.email ?? ''}
            disabled
            helperText="Email cannot be changed. Contact your admin if you need to update it."
          />
          <div className="flex justify-end pt-2">
            <AppButton onClick={handleSave} isLoading={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </AppButton>
          </div>
        </div>
      </SettingsSection>

      {/* Employees manage their own Google Calendar connection here (AdminRoute blocks
          them from /app/settings); owners/admins use the Settings tab instead. */}
      {user?.role === 'employee' && <GoogleCalendarSection connectError={googleConnectError} />}
    </div>
  )
}
