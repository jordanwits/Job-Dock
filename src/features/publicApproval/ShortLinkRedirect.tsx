import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { CenterCard, PublicLoading, StatusCircle } from '@/components/public/publicUi'

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
      } catch (err: unknown) {
        console.error('Short link resolve error:', err)
        setError(getErrorMessage(err, 'Link not found or expired'))
      }
    }

    redirect()
  }, [code])

  if (error) {
    return (
      <CenterCard>
        <StatusCircle kind="danger" label="Link expired" />
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">Link expired</h2>
        <p className="text-sm leading-relaxed text-ink-muted">{error}</p>
      </CenterCard>
    )
  }

  return <PublicLoading message="Redirecting..." />
}

export default ShortLinkRedirect
