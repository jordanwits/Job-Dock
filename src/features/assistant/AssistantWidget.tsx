import { FormEvent, useState, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, Modal, Textarea } from '@/components/ui'
import { helpApi } from '@/lib/api/help'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { runAssistant, isAssistantConfigured, type ChatLine } from './assistantClient'
import { useSpeechToText } from './useSpeechToText'

export interface AssistantWidgetProps {
  /** When false, the launcher is hidden (e.g. logged-out). */
  enabled?: boolean
}

type PendingConfirm = { summary: string; destructive?: boolean; resolve: (ok: boolean) => void }

export function AssistantWidget({ enabled = true }: AssistantWidgetProps) {
  const { theme } = useTheme()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatLine[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  // Report a problem (escalation to engineering) - reuses the help backend.
  const [reportOpen, setReportOpen] = useState(false)
  const [reportNote, setReportNote] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const [reportSessionId, setReportSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // The input text when voice input started - spoken words are appended to it.
  const speechBaseRef = useRef('')

  const configured = isAssistantConfigured()
  const clientRoute = `${location.pathname}${location.search || ''}`

  const {
    isSupported: micSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechToText({
    onResult: text => {
      const base = speechBaseRef.current
      setInput(text ? (base.trim() ? `${base.trim()} ${text}` : text) : base)
    },
    onError: msg => setError(msg),
  })

  const toggleMic = () => {
    if (isListening) {
      stopListening()
      return
    }
    setError(null)
    speechBaseRef.current = input
    startListening()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading, pendingConfirm, reportOpen])

  const resetConversation = () => {
    stopListening()
    speechBaseRef.current = ''
    setMessages([])
    setInput('')
    setError(null)
    setToolStatus(null)
    pendingConfirm?.resolve(false)
    setPendingConfirm(null)
    setReportOpen(false)
    setReportNote('')
    setReportNotice(null)
    setReportSessionId(null)
  }

  // Send the conversation (plus an optional note) to engineering. The backend
  // report endpoint needs a help session id; we create one lazily and reuse it.
  const sendReport = async () => {
    setError(null)
    setReportNotice(null)
    setReportLoading(true)
    try {
      let sid = reportSessionId
      if (!sid) {
        sid = (await helpApi.createSession()).id
        setReportSessionId(sid)
      }
      const transcript = messages
        .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
        .join('\n\n')
      const summary =
        [reportNote.trim(), transcript && `--- Assistant conversation ---\n${transcript}`]
          .filter(Boolean)
          .join('\n\n') || undefined
      const res = await helpApi.report({ sessionId: sid, summary, clientRoute })
      setReportNotice(
        res.alreadySent
          ? 'We already got a report for this conversation.'
          : 'Sent. We’ll follow up by email if needed.'
      )
      setReportOpen(false)
      setReportNote('')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || (err instanceof Error ? err.message : 'Could not send.')
      setError(msg)
    } finally {
      setReportLoading(false)
    }
  }

  // Returns a promise the agent loop awaits before running a write action.
  const confirmWrite = useCallback(
    (summary: string, confirmOpts?: { destructive?: boolean }) =>
      new Promise<boolean>(resolve => {
        setToolStatus(null)
        setPendingConfirm({ summary, destructive: confirmOpts?.destructive, resolve })
      }),
    []
  )

  const resolveConfirm = (ok: boolean) => {
    pendingConfirm?.resolve(ok)
    setPendingConfirm(null)
  }

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    if (isListening) stopListening()
    setError(null)
    setReportNotice(null)
    setInput('')
    const history = messages
    setMessages(m => [...m, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await runAssistant({
        history,
        message: text,
        confirmWrite,
        onToolActivity: setToolStatus,
        clientRoute,
      })
      setMessages(m => [...m, { role: 'assistant', content: res.reply }])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || (err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setError(msg)
      setMessages(m => m.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
      setToolStatus(null)
      setPendingConfirm(null)
    }
  }

  if (!enabled) return null

  const threadBg = theme === 'dark' ? 'bg-black/25' : 'bg-slate-100/90'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-40 right-5 rounded-full shadow-lg px-4 py-3 text-sm font-medium inline-flex items-center gap-1.5',
          'bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          theme === 'dark'
            ? 'bg-primary-gold text-primary-dark focus-visible:ring-primary-gold'
            : 'bg-primary-gold text-primary-dark focus-visible:ring-primary-gold'
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l1.9 4.8L18.7 8.7 13.9 10.6 12 15.4 10.1 10.6 5.3 8.7l4.8-1.9L12 2zm6 11l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3zM5 14l.7 1.8 1.8.7-1.8.7L5 19l-.7-1.8L2.5 16.5l1.8-.7L5 14z" />
        </svg>
        Assistant
      </button>

      <Modal
        isOpen={open}
        onClose={() => {
          stopListening()
          setOpen(false)
        }}
        title="AI Assistant"
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
                setReportOpen(v => !v)
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
              Report a problem
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
        <div className="flex flex-col -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 min-h-[min(70dvh,520px)] max-h-[min(85dvh,600px)] sm:max-h-[560px]">
          {/* Message thread */}
          <div
            className={cn('flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-2', threadBg)}
            role="log"
            aria-label="Assistant messages"
          >
            {reportNotice && (
              <p
                className={cn(
                  'text-center text-xs py-2 px-3 rounded-lg mx-4',
                  theme === 'dark'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-emerald-50 text-emerald-800'
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
                  Ask me how something works, or tell me what to do - I can answer JobDock questions
                  and take actions for you. Try{' '}
                  <span className="font-medium text-current">“How do I send a quote?”</span> or{' '}
                  <span className="font-medium text-current">
                    “Book a 1-hour consultation with Sarah tomorrow at 2pm”
                  </span>
                  . I’ll ask you to confirm before changing anything.
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

            {/* Confirmation card for write actions */}
            {pendingConfirm && (
              <div
                className={cn(
                  'mx-1 my-1 rounded-2xl border px-4 py-3 shadow-sm',
                  pendingConfirm.destructive
                    ? theme === 'dark'
                      ? 'bg-red-500/10 border-red-500/50 text-red-100'
                      : 'bg-red-50 border-red-300 text-red-900'
                    : theme === 'dark'
                      ? 'bg-primary-dark-secondary border-primary-gold/50 text-primary-light/95'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                )}
                role="alertdialog"
                aria-label="Confirm action"
              >
                <p className="text-sm font-medium mb-1">
                  {pendingConfirm.destructive ? '⚠️ Confirm deletion' : 'Confirm this action?'}
                </p>
                <p className="text-sm mb-3">{pendingConfirm.summary}</p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => resolveConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={pendingConfirm.destructive ? 'danger' : 'primary'}
                    onClick={() => resolveConfirm(true)}
                  >
                    {pendingConfirm.destructive ? 'Delete' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}

            {loading && !pendingConfirm && (
              <div className="flex justify-start">
                <div
                  className={cn(
                    'rounded-2xl rounded-bl-md px-4 py-3 text-sm flex gap-2 items-center',
                    theme === 'dark'
                      ? 'bg-primary-dark-secondary text-primary-light/70 border border-primary-blue/40'
                      : 'bg-white text-primary-lightTextSecondary border border-gray-200/80'
                  )}
                  aria-busy="true"
                >
                  {toolStatus ? (
                    <span className="text-xs">{toolStatus}…</span>
                  ) : (
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
                  )}
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
                Found a bug or stuck on something? Add an optional note - we’ll include this
                conversation and send it to our engineering team.
              </p>
              <Textarea
                value={reportNote}
                onChange={e => setReportNote(e.target.value)}
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

          {!configured ? (
            <div
              className={cn(
                'p-4 border-t text-sm',
                theme === 'dark'
                  ? 'border-primary-blue/30 bg-primary-dark-secondary text-primary-light/80'
                  : 'border-gray-200 bg-white text-primary-lightTextSecondary'
              )}
            >
              Assistant unavailable in dev mode. To test locally add{" "}
              <code className="font-mono text-xs">VITE_OPENAI_API_KEY</code>{" "}
              to{" "}
              <code className="font-mono text-xs">.env.local</code>{" "}
              and restart. (Dev-only key - not needed in production.)
            </div>
          ) : (
            <form
              onSubmit={sendMessage}
              className={cn(
                'flex gap-2 items-end p-3 border-t',
                theme === 'dark'
                  ? 'border-primary-blue/30 bg-primary-dark-secondary'
                  : 'border-gray-200 bg-white'
              )}
            >
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? 'Listening… speak now' : 'Ask me to do something…'}
                rows={1}
                disabled={loading}
                className={cn(
                  'flex-1 min-h-[44px] max-h-[120px] resize-none text-sm rounded-2xl py-3',
                  theme === 'dark' ? 'bg-primary-dark' : 'bg-slate-50'
                )}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendMessage()
                  }
                }}
              />
              {micSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={loading}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={isListening}
                  className={cn(
                    'shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isListening
                      ? 'bg-red-500 text-white focus-visible:ring-red-500 animate-pulse'
                      : theme === 'dark'
                        ? 'bg-primary-dark text-primary-light/80 border border-primary-blue/40 hover:bg-primary-dark/70 focus-visible:ring-primary-gold'
                        : 'bg-slate-100 text-primary-lightTextSecondary hover:bg-slate-200 focus-visible:ring-primary-gold'
                  )}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
                    <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={cn(
                  'shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-opacity',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:ring-offset-2',
                  'bg-primary-gold text-primary-dark hover:bg-primary-gold/90'
                )}
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </Modal>
    </>
  )
}
