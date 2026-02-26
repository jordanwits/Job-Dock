import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'

const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const redirect = async () => {
      if (!code) {
        setError('Invalid link')
        return
      }

      try {
        const response = await publicApiClient.get(`/s/${code}`)
        const url = response.data?.url
        if (url) {
          window.location.href = url
        } else {
          setError('Link not found or expired')
        }
      } catch (err: any) {
        console.error('Short link resolve error:', err)
        setError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            'Link not found or expired'
        )
      }
    }

    redirect()
  }, [code])

  if (error) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-primary-dark-secondary rounded-lg shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-semibold text-red-500 mb-2">Link Expired</h2>
          <p className="text-primary-light/70">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto mb-4"></div>
        <p className="text-primary-light/70">Redirecting...</p>
      </div>
    </div>
  )
}

export default ShortLinkRedirect
