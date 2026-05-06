import { FormEvent, useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, Modal, Textarea } from '@/components/ui'
import { helpApi } from '@/lib/api/help'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

type ChatLine = { role: 'user' | 'assistant'; content: string }

export interface HelpChatWidgetProps {
  /** When absent, the launcher is hidden (e.g. logged-out). */
  enabled?: boolean
}

export function HelpChatWidget({ enabled = true }: HelpChatWidgetProps) {
  const { theme } = useTheme()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatLine[]>([])
  const [input, setInput] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading, reportOpen])

  const clientRoute = `${location.pathname}${location.search || ''}`

  const resetConversation = () => {
    setSessionId(null)
    setMessages([])
    setInput('')
    setReportNote('')
    setReportOpen(false)
    setError(null)
    setReportNotice(null)
  }

  const ensureSessionId = async (): Promise<string> => {
    if (sessionId) return sessionId
    const s = await helpApi.createSession()
    setSessionId(s.id)
    return s.id
  }

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    setReportNotice(null)
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await helpApi.chat({
        sessionId: sessionId ?? undefined,
        message: text,
        clientRoute,
      })
      setSessionId(res.sessionId)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ||
        (err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setError(msg)
      setMessages((m) => m.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const sendReport = async () => {
    setError(null)
    setReportNotice(null)
    setReportLoading(true)
    try {
      const sid = await ensureSessionId()
      const res = await helpApi.report({
        sessionId: sid,
        summary: reportNote.trim() || undefined,
        clientRoute,
      })
      if (res.alreadySent) {
        setReportNotice('We already got a report for this conversation.')
      } else {
        setReportNotice('Sent. We will follow up by email if needed.')
      }
      setReportOpen(false)
      setReportNote('')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ||
        (err instanceof Error ? err.message : 'Could not send.')
      setError(msg)
    } finally {
      setReportLoading(false)
    }
  }

  if (!enabled) return null

  const threadBg =
    theme === 'dark'
      ? 'bg-black/25'
      : 'bg-slate-100/90'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-40 right-5 rounded-full shadow-lg px-4 py-3 text-sm font-medium',
          'bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          theme === 'dark'
            ? 'bg-primary-light text-primary-dark focus-visible:ring-primary-light'
            : 'bg-primary-lightText text-white focus-visible:ring-primary-lightText'
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Help
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Help"
        size="lg"
        mobilePosition="bottom"
        closeOnOverlayClick
        fitContentOnMobile
        compactOnMobile
        headerRight={
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setReportOpen((v) => !v)
                setReportNotice(null)
              }}
              className={cn(
                'text-xs font-medium rounded-md px-2 py-1 -mr-1 transition-colors',
                theme === 'dark'
                  ? 'text-primary-light/80 hover:bg-white/10'
                  : 'text-primary-lightTextSecondary hover:bg-black/5',
                reportOpen && (theme === 'dark' ? 'bg-white/10' : 'bg-black/5')
              )}
            >
              Report issue
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetConversation}
              className="text-xs px-2"
            >
              New chat
            </Button>
          </div>
        }
      >
        <div
          className={cn(
            'flex flex-col -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 min-h-[min(70dvh,520px)] max-h-[min(85dvh,600px)] sm:max-h-[560px]'
          )}
        >
          {/* Message thread */}
          <div
            className={cn(
              'flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-2',
              threadBg
            )}
            role="log"
            aria-label="Help chat messages"
          >
            {reportNotice && (
              <p
                className={cn(
                  'text-center text-xs py-2 px-3 rounded-lg mx-4',
                  theme === 'dark' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-emerald-50 text-emerald-800'
                )}
                role="status"
              >
                {reportNotice}
              </p>
            )}

            {messages.length === 0 && !loading && (
              <div
                className={cn(
                  'flex flex-col items-center justify-center text-center px-6 py-12 max-w-sm mx-auto',
                  theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                )}
              >
                <p className="text-sm leading-relaxed">
                  Message us like a text thread. Ask how something works, what to try next, or tap{' '}
                  <span className="font-medium text-current">Report issue</span> if something is broken.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                className={cn('flex w-full', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] sm:max-w-[80%] px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm',
                    m.role === 'user'
                      ? cn(
                          'rounded-2xl rounded-br-md',
                          theme === 'dark'
                            ? 'bg-primary-blue text-primary-light'
                            : 'bg-primary-blue text-white'
                        )
                      : cn(
                          'rounded-2xl rounded-bl-md',
                          theme === 'dark'
                            ? 'bg-primary-dark-secondary text-primary-light/95 border border-primary-blue/40'
                            : 'bg-white text-primary-lightText border border-gray-200/80'
                        )
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className={cn(
                    'rounded-2xl rounded-bl-md px-4 py-3 text-sm flex gap-1 items-center',
                    theme === 'dark'
                      ? 'bg-primary-dark-secondary text-primary-light/70 border border-primary-blue/40'
                      : 'bg-white text-primary-lightTextSecondary border border-gray-200/80'
                  )}
                  aria-busy="true"
                >
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse"
                      style={{ animationDelay: '300ms' }}
                    />
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-1" />
          </div>

          {reportOpen && (
            <div
              className={cn(
                'border-t px-3 py-3 space-y-2',
                theme === 'dark' ? 'border-primary-blue/30 bg-primary-dark' : 'border-gray-200 bg-white'
              )}
            >
              <p
                className={cn(
                  'text-xs',
                  theme === 'dark' ? 'text-primary-light/65' : 'text-primary-lightTextSecondary'
                )}
              >
                Optional note — we will include your recent messages.
              </p>
              <Textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="What happened? (optional)"
                rows={2}
                disabled={reportLoading}
                className="min-h-[72px] resize-none text-sm rounded-xl"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReportOpen(false)
                    setReportNote('')
                  }}
                  disabled={reportLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void sendReport()}
                  disabled={reportLoading}
                  isLoading={reportLoading}
                >
                  Send to engineering
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p
              className={cn(
                'text-xs px-3 py-2 border-t',
                theme === 'dark' ? 'border-primary-blue/20 text-red-400' : 'border-gray-100 text-red-600'
              )}
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Composer — messaging style */}
          <form
            onSubmit={sendMessage}
            className={cn(
              'flex gap-2 items-end p-3 border-t',
              theme === 'dark' ? 'border-primary-blue/30 bg-primary-dark-secondary' : 'border-gray-200 bg-white'
            )}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message…"
              rows={1}
              disabled={loading}
              className={cn(
                'flex-1 min-h-[44px] max-h-[120px] resize-none text-sm rounded-2xl py-3',
                theme === 'dark' ? 'bg-primary-dark' : 'bg-slate-50'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={cn(
                'shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-opacity',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:ring-offset-2',
                theme === 'dark'
                  ? 'bg-primary-gold text-primary-dark hover:bg-primary-gold/90'
                  : 'bg-primary-gold text-primary-dark hover:bg-primary-gold/90'
              )}
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </form>
        </div>
      </Modal>
    </>
  )
}
