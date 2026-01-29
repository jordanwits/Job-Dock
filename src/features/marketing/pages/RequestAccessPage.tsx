import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import { publicApiClient } from '@/lib/api/client'

const RequestAccessPage = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await publicApiClient.post('/early-access/request', { name, email })
      setSuccess(true)
      setName('')
      setEmail('')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MarketingLayout>
      <MarketingSection variant="gradient-dark" className="min-h-screen flex items-center">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Request <span className="text-primary-gold">Early Access</span>
              </h1>
              <p className="text-lg text-white/80">
                Join the waitlist to be among the first to experience JobDock.
              </p>
            </div>

            {success ? (
              <div className="bg-white rounded-2xl p-8 md:p-10 shadow-2xl text-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Thanks for your interest!</h2>
                <p className="text-gray-700 mb-6">
                  We've received your request and will review it shortly.{' '}
                  <strong>Watch your inbox</strong> — once approved, you'll receive an email with a
                  direct link to create your account.
                </p>
                <Link to="/">
                  <Button variant="primary" className="w-full">
                    Back to Home
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 md:p-10 shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Submitting...' : 'Request Access'}
                    </Button>
                  </div>

                  <p className="text-sm text-gray-600 text-center">
                    Already have access?{' '}
                    <a
                      href="/auth/login"
                      className="text-primary-blue hover:text-primary-gold font-medium transition-colors"
                    >
                      Sign in
                    </a>
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default RequestAccessPage
