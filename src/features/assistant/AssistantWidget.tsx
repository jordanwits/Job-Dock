import { FormEvent, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { helpApi } from '@/lib/api/help'
import { cn } from '@/lib/utils'
import { runAssistant, isAssistantConfigured, type ChatLine } from './assistantClient'
import { useSpeechToText } from './useSpeechToText'

export interface AssistantWidgetProps {
  /** When false, the launcher is hidden (e.g. logged-out). */
  enabled?: boolean
}

type PendingConfirm = { summary: string; destructive?: boolean; resolve: (ok: boolean) => void }

/* ── Icons ────────────────────────────────────────────────────────────── */
type IconProps = { className?: string }
const SparkleIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2l1.7 4.9a3 3 0 0 0 1.9 1.9L20.5 10.5l-4.9 1.7a3 3 0 0 0-1.9 1.9L12 19l-1.7-4.9a3 3 0 0 0-1.9-1.9L3.5 10.5l4.9-1.7a3 3 0 0 0 1.9-1.9L12 2z" />
    <path d="M19 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" opacity="0.85" />
  </svg>
)
const SendIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
)
const MicIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
    <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z" />
  </svg>
)
const XIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
)
const RefreshIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
  </svg>
)
const FlagIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 21V4m0 0c3-1.5 6 1.5 9 0s5-1 7 0v9c-2-1-4-1.5-7 0s-6-1.5-9 0" />
  </svg>
)
const AlertIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
)

/** The little gradient sparkle avatar that gives the bot a face. */
function AssistantMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' }
  const icon = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-accent-contrast shadow-sm ring-1 ring-inset ring-white/15',
        sizes[size],
        className
      )}
      aria-hidden
    >
      <SparkleIcon className={icon[size]} />
    </span>
  )
}

const SUGGESTIONS = [
  'How do I send a quote?',
  "What's overdue this week?",
  'Book a 1-hour consult with Sarah tomorrow at 2pm',
]

export function AssistantWidget({ enabled = true }: AssistantWidgetProps) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  // Entrance/exit animation + close helper.
  // Use a timer (not requestAnimationFrame) so the panel still becomes visible
  // when the tab is backgrounded/hidden — rAF callbacks are paused while hidden.
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => setMounted(true), 10)
    return () => window.clearTimeout(id)
  }, [open])

  const closePanel = useCallback(() => {
    stopListening()
    setMounted(false)
    window.setTimeout(() => setOpen(false), 180)
  }, [stopListening])

  // Escape closes the panel
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    if (!open) return
    const mq = window.matchMedia('(max-width: 639px)')
    if (!mq.matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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

  const sendMessage = async (e?: FormEvent, override?: string) => {
    e?.preventDefault()
    const text = (override ?? input).trim()
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

  /* ── Launcher (FAB) ───────────────────────────────────────────────────── */
  const launcher = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'group fixed right-5 z-40 inline-flex items-center gap-2 rounded-full bg-accent-strong py-2.5 pl-2.5 pr-4 text-sm font-semibold text-accent-contrast shadow-pop',
        'bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]',
        'transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accent active:translate-y-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        open && 'pointer-events-none scale-90 opacity-0'
      )}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Open AI assistant"
    >
      <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/20" style={{ animationDuration: '2.4s' }} />
        <SparkleIcon className="relative h-4 w-4" />
      </span>
      Assistant
    </button>
  )

  /* ── Bubbles ──────────────────────────────────────────────────────────── */
  const Bubble = ({ role, children }: { role: ChatLine['role']; children: ReactNode }) => {
    if (role === 'user') {
      return (
        <div className="flex w-full justify-end">
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent-strong px-3.5 py-2.5 text-sm text-accent-contrast shadow-sm">
            {children}
          </div>
        </div>
      )
    }
    return (
      <div className="flex w-full items-end gap-2">
        <AssistantMark size="sm" className="mb-0.5" />
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm ring-1 ring-line">
          {children}
        </div>
      </div>
    )
  }

  const panel = (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[95] bg-black/40 transition-opacity duration-200 sm:hidden',
          mounted ? 'opacity-100' : 'opacity-0'
        )}
        onClick={closePanel}
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="AI Assistant"
        className={cn(
          'fixed z-[100] flex flex-col overflow-hidden bg-canvas shadow-pop ring-1 ring-line',
          // mobile bottom sheet
          'inset-x-0 bottom-0 h-[88dvh] max-h-[88dvh] rounded-t-2xl',
          // desktop docked card
          'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,82vh)] sm:w-[400px] sm:rounded-2xl',
          'transition-all duration-200 ease-out',
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <AssistantMark size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-ink">Assistant</p>
            <p className="flex items-center gap-1.5 text-[12px] leading-tight text-ink-subtle">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              JobDock AI · online
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setReportOpen(v => !v)
                setReportNotice(null)
              }}
              title="Report a problem"
              aria-label="Report a problem"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                reportOpen && 'bg-surface-2 text-ink'
              )}
            >
              <FlagIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={resetConversation}
              title="New chat"
              aria-label="New chat"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RefreshIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={closePanel}
              title="Close"
              aria-label="Close assistant"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <XIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        {/* Message thread */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4" role="log" aria-label="Assistant messages">
          {reportNotice && (
            <p className="mx-auto max-w-[90%] rounded-lg bg-success-soft px-3 py-2 text-center text-xs text-success" role="status">
              {reportNotice}
            </p>
          )}

          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center px-2 pb-2 pt-6 text-center">
              <AssistantMark size="lg" className="mb-3" />
              <p className="text-[15px] font-semibold text-ink">How can I help?</p>
              <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-ink-muted">
                Ask how something works, or tell me what to do — I can answer JobDock questions and
                take actions for you. I’ll always confirm before changing anything.
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage(undefined, s)}
                    className="group flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-2.5 text-left text-[13px] text-ink shadow-card ring-1 ring-line transition-colors hover:bg-surface-2 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-accent-strong" />
                    <span className="min-w-0">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={`${i}-${m.role}-${m.content.slice(0, 12)}`} role={m.role}>
              {m.content}
            </Bubble>
          ))}

          {/* Confirmation card for write actions */}
          {pendingConfirm && (
            <div
              className={cn(
                'flex items-start gap-2.5 rounded-2xl px-4 py-3 shadow-sm ring-1 ring-inset',
                pendingConfirm.destructive
                  ? 'bg-danger-soft text-danger ring-danger/30'
                  : 'bg-warning-soft text-warning ring-warning/30'
              )}
              role="alertdialog"
              aria-label="Confirm action"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {pendingConfirm.destructive ? 'Confirm deletion' : 'Confirm this action?'}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{pendingConfirm.summary}</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => resolveConfirm(false)}
                    className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveConfirm(true)}
                    className={cn(
                      'inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                      pendingConfirm.destructive ? 'bg-danger focus-visible:ring-danger' : 'bg-accent-strong text-accent-contrast focus-visible:ring-accent'
                    )}
                  >
                    {pendingConfirm.destructive ? 'Delete' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && !pendingConfirm && (
            <div className="flex w-full items-end gap-2" aria-busy="true">
              <AssistantMark size="sm" className="mb-0.5" />
              <div className="rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-ink-muted shadow-sm ring-1 ring-line">
                {toolStatus ? (
                  <span className="text-xs">{toolStatus}…</span>
                ) : (
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-1" />
        </div>

        {/* Report a problem */}
        {reportOpen && (
          <div className="shrink-0 space-y-2 border-t border-line bg-surface px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-ink-subtle">
              Found a bug or stuck on something? Add an optional note — we’ll include this
              conversation and send it to our engineering team.
            </p>
            <textarea
              value={reportNote}
              onChange={e => setReportNote(e.target.value)}
              placeholder="What happened? (optional)"
              rows={2}
              disabled={reportLoading}
              className="min-h-[64px] w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-60"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportOpen(false)
                  setReportNote('')
                }}
                disabled={reportLoading}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendReport()}
                disabled={reportLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-strong px-3 text-[13px] font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {reportLoading && (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Send to engineering
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="shrink-0 border-t border-line bg-danger-soft px-3.5 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Composer */}
        {!configured ? (
          <div className="shrink-0 border-t border-line bg-surface p-4 text-sm text-ink-muted">
            Assistant unavailable in dev mode. To test locally add{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs text-accent-strong">VITE_OPENAI_API_KEY</code>{' '}
            to <code className="rounded bg-surface-2 px-1 font-mono text-xs text-accent-strong">.env.local</code> and
            restart. (Dev-only key — not needed in production.)
          </div>
        ) : (
          <form
            onSubmit={sendMessage}
            className="shrink-0 border-t border-line bg-surface p-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-end gap-1.5 rounded-2xl bg-surface-2 p-1.5 ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-accent">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? 'Listening… speak now' : 'Ask me to do something…'}
                rows={1}
                disabled={loading}
                className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none disabled:opacity-60"
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
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
                    isListening
                      ? 'animate-pulse bg-danger text-white focus-visible:ring-danger'
                      : 'text-ink-subtle hover:bg-surface hover:text-ink focus-visible:ring-accent'
                  )}
                >
                  <MicIcon className="h-[18px] w-[18px]" />
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-strong text-accent-contrast transition-[opacity,transform] hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
              >
                <SendIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )

  return (
    <>
      {launcher}
      {open && createPortal(panel, document.body)}
    </>
  )
}
