import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import apiClient from '@/lib/api/client'

type ApprovalAction = 'accept' | 'decline'

const InvoiceApprovalPage = () => {
  const { id, action } = useParams<{ id: string; action: ApprovalAction }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')

  useEffect(() => {
    const handleApproval = async () => {
      if (!id || !token || !action) {
        setError('Invalid approval link')
        setLoading(false)
        return
      }

      try {
        const endpoint = action === 'accept' 
          ? `/invoices/${id}/approve-public`
          : `/invoices/${id}/decline-public`
        
        const response = await apiClient.post(`${endpoint}?token=${token}`, {})
        setInvoiceNumber(response.data.invoiceNumber || id)
        setSuccess(true)
      } catch (err: any) {
        console.error('Approval error:', err)
        setError(
          err.response?.data?.error?.message || 
          err.response?.data?.message || 
          err.message || 
          'Failed to process your response. The link may be invalid or expired.'
        )
      } finally {
        setLoading(false)
      }
    }

    handleApproval()
  }, [id, token, action])

  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-primary-dark-secondary rounded-lg shadow-xl p-8 text-center">
        {/* Logo/Branding */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary-gold">JobDock</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto"></div>
            <p className="text-primary-light/70">Processing your response...</p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="text-5xl mb-4">
              {action === 'accept' ? '✅' : '⚠️'}
            </div>
            <h2 className="text-2xl font-semibold text-primary-light mb-2">
              {action === 'accept' ? 'Invoice Approved!' : 'Invoice Declined'}
            </h2>
            <p className="text-primary-light/70">
              {action === 'accept' 
                ? `Thank you for approving invoice ${invoiceNumber}. The contractor has been notified.`
                : `Invoice ${invoiceNumber} has been declined. The contractor has been notified and will reach out to you.`
              }
            </p>
            {action === 'accept' && (
              <p className="text-sm text-primary-light/60 mt-4">
                Note: This approval does not constitute payment. Please remit payment according to the invoice terms.
              </p>
            )}
            <p className="text-sm text-primary-light/50 mt-6">
              You can safely close this window.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-semibold text-red-500 mb-2">
              Error
            </h2>
            <p className="text-primary-light/70">{error}</p>
            <p className="text-sm text-primary-light/50 mt-6">
              Please contact the contractor directly if you need assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvoiceApprovalPage
