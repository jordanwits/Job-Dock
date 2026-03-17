import { useState } from 'react'
import { Button, Card, Textarea } from '@/components/ui'
import { settingsApi } from '@/lib/api/settings'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

export const FeedbackSection = () => {
  const { theme } = useTheme()
  const [category, setCategory] = useState<'problem' | 'suggestion'>('problem')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await settingsApi.submitFeedback({ category, message: message.trim() })
      setSubmitted(true)
      setMessage('')
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null
      setError(msg || 'Failed to send feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className={cn(
        "text-xl font-semibold",
        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
      )}>Feedback</h2>
      <p className={cn(
        "text-sm",
        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
      )}>
        Found a bug or have an idea? Your feedback helps us improve JobDock. Submissions are sent directly to the development team.
      </p>
      <Card className="p-6">
        {submitted ? (
          <div className="space-y-4">
            <p className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>Thank you for your feedback!</p>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>
              Your submission has been sent. We appreciate you taking the time to help us improve.
            </p>
            <Button
              variant="outline"
              onClick={() => setSubmitted(false)}
            >
              Send another feedback
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className={cn(
                "block text-sm font-medium mb-3",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>Category</label>
              <div className="flex gap-4">
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
                )}>
                  <input
                    type="radio"
                    name="category"
                    checked={category === 'problem'}
                    onChange={() => setCategory('problem')}
                    className="rounded-full border-gray-300 text-primary-gold focus:ring-primary-gold"
                  />
                  <span>Report a problem</span>
                </label>
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
                )}>
                  <input
                    type="radio"
                    name="category"
                    checked={category === 'suggestion'}
                    onChange={() => setCategory('suggestion')}
                    className="rounded-full border-gray-300 text-primary-gold focus:ring-primary-gold"
                  />
                  <span>Suggest a change / feature</span>
                </label>
              </div>
            </div>
            <Textarea
              label="Your feedback"
              placeholder={category === 'problem'
                ? "Describe the problem you encountered..."
                : "Describe your suggestion or feature idea..."}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              required
              error={error || undefined}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !message.trim()}
              isLoading={submitting}
            >
              Submit Feedback
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
