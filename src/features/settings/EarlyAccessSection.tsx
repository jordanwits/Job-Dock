import { useState, useEffect } from 'react'
import { Button, Input } from '@/components/ui'
import { earlyAccessApi, EarlyAccessRequest } from '@/lib/api/earlyAccess'
import { useAuthStore } from '@/features/auth/store/authStore'

export const EarlyAccessSection = () => {
  const user = useAuthStore(state => state.user)
  const [requests, setRequests] = useState<EarlyAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [manualEmail, setManualEmail] = useState('')
  const [approving, setApproving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Only show for jordan@westwavecreative.com
  if (!user || user.email !== 'jordan@westwavecreative.com') {
    return null
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const data = await earlyAccessApi.getRequests()
      setRequests(data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    setApproving(requestId)
    try {
      await earlyAccessApi.approve(requestId)
      await loadRequests()
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to approve request')
    } finally {
      setApproving(null)
    }
  }

  const handleManualApprove = async () => {
    if (!manualEmail.trim()) return

    setApproving('manual')
    try {
      await earlyAccessApi.approve(manualEmail.trim())
      setManualEmail('')
      await loadRequests()
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to approve email')
    } finally {
      setApproving(null)
    }
  }

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return

    setDeleting(requestId)
    try {
      await earlyAccessApi.delete(requestId)
      await loadRequests()
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete request')
    } finally {
      setDeleting(null)
    }
  }

  const pendingRequests = requests.filter(r => !r.approvedAt)

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-primary-light">Early Access Management</h2>
        <div className="text-primary-light/70">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-light">Early Access Management</h2>
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Manual approval */}
        <div>
          <h3 className="text-lg font-medium text-primary-light mb-3">Manually Approve Email</h3>
          <p className="text-sm text-primary-light/70 mb-3">
            Add an email address directly to the allowlist (even if they haven't submitted a
            request).
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={manualEmail}
              onChange={e => setManualEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1"
            />
            <Button
              onClick={handleManualApprove}
              disabled={!manualEmail.trim() || approving === 'manual'}
            >
              {approving === 'manual' ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>

        {/* Pending requests */}
        <div>
          <h3 className="text-lg font-medium text-primary-light mb-3">
            Pending Requests ({pendingRequests.length})
          </h3>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-primary-light/60">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-primary-dark-secondary rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary-light">{request.name}</p>
                    <p className="text-xs text-primary-light/70">{request.email}</p>
                    <p className="text-xs text-primary-light/50 mt-1">
                      Requested {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={approving === request.id || deleting === request.id}
                    >
                      {approving === request.id ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(request.id)}
                      disabled={approving === request.id || deleting === request.id}
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      {deleting === request.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
