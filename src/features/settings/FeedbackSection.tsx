import { useState } from 'react'
import { settingsApi } from '@/lib/api/settings'
import { AppButton, Panel, TextAreaField, SettingsSection } from './settingsUi'

export const FeedbackSection = () => {
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

  const radioCls =
    'flex cursor-pointer items-center gap-2 text-sm text-ink-muted'

  return (
    <SettingsSection
      title="Feedback"
      description="Found a bug or have an idea? Your feedback helps us improve JobDock. Submissions are sent directly to the development team."
    >
      <Panel className="p-5 sm:p-6">
        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-ink">Thank you for your feedback!</p>
            <p className="text-sm text-ink-muted">
              Your submission has been sent. We appreciate you taking the time to help us improve.
            </p>
            <AppButton variant="subtle" onClick={() => setSubmitted(false)}>
              Send another feedback
            </AppButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-medium text-ink">Category</label>
              <div className="flex flex-wrap gap-5">
                <label className={radioCls}>
                  <input
                    type="radio"
                    name="category"
                    checked={category === 'problem'}
                    onChange={() => setCategory('problem')}
                    className="h-4 w-4"
                    style={{ accentColor: 'var(--accent-strong)' }}
                  />
                  <span>Report a problem</span>
                </label>
                <label className={radioCls}>
                  <input
                    type="radio"
                    name="category"
                    checked={category === 'suggestion'}
                    onChange={() => setCategory('suggestion')}
                    className="h-4 w-4"
                    style={{ accentColor: 'var(--accent-strong)' }}
                  />
                  <span>Suggest a change / feature</span>
                </label>
              </div>
            </div>
            <TextAreaField
              label="Your feedback"
              placeholder={category === 'problem'
                ? 'Describe the problem you encountered...'
                : 'Describe your suggestion or feature idea...'}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              required
              error={error || undefined}
            />
            <AppButton type="submit" disabled={submitting || !message.trim()} isLoading={submitting}>
              Submit feedback
            </AppButton>
          </form>
        )}
      </Panel>
    </SettingsSection>
  )
}
