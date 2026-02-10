import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button, Input, ConfirmationDialog, Modal } from '@/components/ui'
import type { TimeEntry } from '../types/jobLog'
import { useJobLogStore } from '../store/jobLogStore'

const DIGIT_POSITIONS = [0, 1, 3, 4, 6, 7] // HH:MM:SS - indices for digits

function processDurationKey(
  value: string,
  key: string,
  cursorPos: number
): { newValue: string; newCursor: number } | null {
  const getDigitIndex = (pos: number) => {
    const idx = DIGIT_POSITIONS.findIndex(p => p >= pos)
    return idx >= 0 ? idx : 5
  }
  const digits = value.replace(/\D/g, '').padEnd(6, '0').slice(0, 6)
  const arr = digits.split('')

  if (key >= '0' && key <= '9') {
    const di = getDigitIndex(cursorPos)
    const slot = di
    const unit = Math.floor(slot / 2)
    const isFirstDigit = slot % 2 === 0

    if (unit === 1 || unit === 2) {
      if (isFirstDigit && (key === '6' || key === '7' || key === '8' || key === '9')) return null
      if (!isFirstDigit) {
        const first = arr[slot - 1]
        const combined = first + key
        const max = unit === 1 ? 59 : 59
        if (parseInt(combined, 10) > max) return null
      }
    }

    arr[slot] = key
    const newStr = `${arr[0]}${arr[1]}:${arr[2]}${arr[3]}:${arr[4]}${arr[5]}`
    const nextSlot = Math.min(slot + 1, 5)
    return { newValue: newStr, newCursor: DIGIT_POSITIONS[nextSlot] + (nextSlot === 5 ? 1 : 0) }
  }

  if (key === 'Backspace') {
    const di = getDigitIndex(cursorPos)
    const slot = di
    const prevSlot = slot - 1
    if (prevSlot < 0) return null
    arr[prevSlot] = '0'
    const newStr = `${arr[0]}${arr[1]}:${arr[2]}${arr[3]}:${arr[4]}${arr[5]}`
    return { newValue: newStr, newCursor: DIGIT_POSITIONS[prevSlot] }
  }

  return null
}

interface TimeTrackerProps {
  jobLogId: string
  jobLogTitle: string
  timeEntries: TimeEntry[]
}

const TIMER_STORAGE_KEY = 'joblog-active-timer'

function TimeNumberInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const parts = value ? value.split(':') : ['', '']
  const h24 = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0))
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  const isPM = h24 >= 12
  const setFrom12h = (hour12: number, pm: boolean) => {
    const h24new = pm ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12
    onChange(`${h24new}`.padStart(2, '0') + ':' + `${m}`.padStart(2, '0'))
  }
  const setH = (v: number) => setFrom12h(Math.min(12, Math.max(1, v)), isPM)
  const setM = (v: number) =>
    onChange(`${h24}`.padStart(2, '0') + ':' + `${Math.min(59, Math.max(0, v))}`.padStart(2, '0'))
  const toggleAMPM = () => setFrom12h(h12, !isPM)
  const base =
    'bg-transparent text-primary-light focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  const inputSize = 'h-9 w-8 min-w-0 px-0.5 py-1 text-base sm:text-sm'
  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <span className="text-xs font-medium text-primary-light/60">{label}</span>
      )}
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          min={1}
          max={12}
          value={h12}
          onChange={e => setH(parseInt(e.target.value, 10) || 1)}
          className={cn(base, inputSize, 'text-left pl-0')}
          placeholder="hr"
          aria-label={label ? `${label} hour` : undefined}
        />
        <span className="text-primary-light/50 shrink-0">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={m}
          onChange={e => setM(parseInt(e.target.value, 10) || 0)}
          className={cn(base, inputSize, 'text-left')}
          placeholder="min"
          aria-label={label ? `${label} minute` : undefined}
        />
        <button
          type="button"
          onClick={toggleAMPM}
          className={cn(
            base,
            'h-9 w-9 min-w-0 px-0.5 py-1 text-xs font-medium shrink-0',
            isPM ? 'text-primary-gold' : 'text-primary-light/70'
          )}
          aria-label={label ? `${label} AM/PM` : undefined}
        >
          {isPM ? 'PM' : 'AM'}
        </button>
      </div>
    </div>
  )
}

const TimeTracker = ({ jobLogId, jobLogTitle, timeEntries }: TimeTrackerProps) => {
  const { createTimeEntry, updateTimeEntry, deleteTimeEntry } = useJobLogStore()
  const [isTimerRunning, setIsTimerRunning] = useState(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!stored) return false
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLogId && startTime
    } catch {
      return false
    }
  })
  const [timerStart, setTimerStart] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!stored) return null
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLogId && startTime ? new Date(startTime) : null
    } catch {
      return null
    }
  })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineNotes, setInlineNotes] = useState('')
  const [inlineTimeEditId, setInlineTimeEditId] = useState<string | null>(null)
  const [inlineStartTime, setInlineStartTime] = useState('')
  const [inlineEndTime, setInlineEndTime] = useState('')
  const [inlineDurationEditId, setInlineDurationEditId] = useState<string | null>(null)
  const [inlineDuration, setInlineDuration] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [descriptionModalId, setDescriptionModalId] = useState<string | null>(null)
  const [descriptionModalEditing, setDescriptionModalEditing] = useState(false)
  const [modalEditNotes, setModalEditNotes] = useState('')
  const durationInputRef = useRef<HTMLInputElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (descriptionModalEditing) {
      requestAnimationFrame(() => {
        const el = modalTextareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      })
    }
  }, [descriptionModalEditing])

  const tick = useCallback(() => {
    if (timerStart) {
      setElapsedSeconds(Math.floor((Date.now() - timerStart.getTime()) / 1000))
    }
  }, [timerStart])

  useEffect(() => {
    if (!isTimerRunning || !timerStart) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isTimerRunning, timerStart, tick])

  const formatElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatDuration = (te: TimeEntry) => {
    const start = new Date(te.startTime).getTime()
    const end = new Date(te.endTime).getTime()
    const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
    const totalSec = Math.round((end - start - breakMin) / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const parseDurationToSeconds = (str: string): number | null => {
    const parts = str
      .trim()
      .split(':')
      .map(p => parseInt(p, 10))
    if (parts.some(n => isNaN(n))) return null
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    if (parts.length === 1) {
      return parts[0]
    }
    return null
  }

  const handleStartTimer = () => {
    const start = new Date()
    setTimerStart(start)
    setIsTimerRunning(true)
    try {
      localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({
          jobLogId,
          startTime: start.toISOString(),
        })
      )
    } catch {
      // ignore
    }
  }

  const handleStopTimer = async () => {
    if (!timerStart) return
    const end = new Date()
    try {
      await createTimeEntry({
        jobLogId,
        startTime: timerStart.toISOString(),
        endTime: end.toISOString(),
      })
    } finally {
      setIsTimerRunning(false)
      setTimerStart(null)
      setElapsedSeconds(0)
      try {
        localStorage.removeItem(TIMER_STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }

  const handleAddEntry = async () => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(now.getHours() - 1, now.getMinutes(), 0, 0)
    try {
      await createTimeEntry({
        jobLogId,
        startTime: start.toISOString(),
        endTime: now.toISOString(),
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeleteId(id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteTimeEntry(deleteId, jobLogId)
      setDeleteId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleInlineNotesSave = async (te: TimeEntry) => {
    if (inlineEditId !== te.id) return
    try {
      await updateTimeEntry(te.id, { notes: inlineNotes || undefined }, jobLogId)
      setInlineEditId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleInlineTimeSave = async (te: TimeEntry) => {
    if (inlineTimeEditId !== te.id || !inlineStartTime || !inlineEndTime) return
    try {
      const startDate = new Date(te.startTime)
      const endDate = new Date(te.endTime)
      const [startH, startM] = inlineStartTime.split(':').map(Number)
      const [endH, endM] = inlineEndTime.split(':').map(Number)
      const newStart = new Date(startDate)
      newStart.setHours(startH, startM, 0, 0)
      const newEnd = new Date(endDate)
      newEnd.setHours(endH, endM, 0, 0)
      if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1)
      await updateTimeEntry(
        te.id,
        {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        },
        jobLogId
      )
      setInlineTimeEditId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const beginTimeEdit = (te: TimeEntry) => {
    setInlineTimeEditId(te.id)
    const start = new Date(te.startTime)
    const end = new Date(te.endTime)
    setInlineStartTime(format(start, 'HH:mm'))
    setInlineEndTime(format(end, 'HH:mm'))
  }

  const beginDurationEdit = (te: TimeEntry) => {
    setInlineDurationEditId(te.id)
    setInlineDuration(formatDuration(te))
  }

  const handleInlineDurationSave = async (te: TimeEntry) => {
    if (inlineDurationEditId !== te.id) return
    const totalSec = parseDurationToSeconds(inlineDuration)
    if (totalSec === null || totalSec < 0) {
      setInlineDurationEditId(null)
      return
    }
    const start = new Date(te.startTime).getTime()
    const breakMs = (te.breakMinutes ?? 0) * 60 * 1000
    const newEnd = new Date(start + totalSec * 1000 + breakMs)
    try {
      await updateTimeEntry(
        te.id,
        {
          endTime: newEnd.toISOString(),
        },
        jobLogId
      )
      setInlineDurationEditId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const totalSeconds = timeEntries.reduce((sum, te) => {
    const start = new Date(te.startTime).getTime()
    const end = new Date(te.endTime).getTime()
    const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
    return sum + (end - start - breakMin) / 1000
  }, 0)
  const totalH = Math.floor(totalSeconds / 3600)
  const totalM = Math.floor((totalSeconds % 3600) / 60)
  const totalS = Math.round(totalSeconds % 60)
  const totalFormatted = `${totalH.toString().padStart(2, '0')}:${totalM.toString().padStart(2, '0')}:${totalS.toString().padStart(2, '0')}`

  return (
    <div className="space-y-4">
      {/* Header: Today | Total */}
      <div className="flex items-center justify-between border-b border-primary-blue/50 pb-3">
        <span className="text-sm font-medium text-primary-light/80">Today</span>
        <div className="flex items-center gap-2">
          {timeEntries.length > 0 && (
            <span className="text-sm text-primary-light/80">
              Total: <span className="font-medium text-primary-gold">{totalFormatted}</span>
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleAddEntry}>
            Add entry
          </Button>
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-nowrap items-center gap-4">
        {!isTimerRunning ? (
          <Button onClick={handleStartTimer} size="sm">
            Start Timer
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-2xl font-mono text-primary-gold tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </span>
            <Button onClick={handleStopTimer} variant="outline" size="sm">
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Time entries list */}
      {timeEntries.length > 0 && (
        <div className="space-y-1">
          {timeEntries.map((te, index) => (
            <div
              key={te.id}
              className={cn(
                'flex gap-2 sm:gap-3 py-2 px-3 rounded-lg bg-primary-dark/30 border border-primary-blue/30 hover:bg-primary-dark/40 transition-colors',
                inlineTimeEditId === te.id
                  ? 'flex-col sm:flex-row sm:flex-nowrap sm:items-center'
                  : 'flex-nowrap items-center overflow-x-auto'
              )}
            >
              {/* Index + Job title + Notes (stays together when row wraps) */}
              <div className="flex items-center gap-2 min-w-0 flex-1 w-full sm:w-auto">
                <div className="w-8 h-8 flex items-center justify-center rounded border border-primary-blue/50 bg-primary-dark/50 text-xs font-medium text-primary-light/80 shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                  <span className="font-semibold text-base text-primary-light truncate">
                    {jobLogTitle}
                  </span>
                  <span className="text-primary-light/50 shrink-0 hidden sm:inline">–</span>
                  {inlineEditId === te.id ? (
                    <input
                      type="text"
                      value={inlineNotes}
                      onChange={e => setInlineNotes(e.target.value)}
                      onBlur={() => handleInlineNotesSave(te)}
                      onKeyDown={e => e.key === 'Enter' && handleInlineNotesSave(te)}
                      placeholder="Add description"
                      className="flex-1 min-w-0 bg-transparent text-sm text-primary-light placeholder:text-primary-light/40 focus:outline-none focus:ring-0"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile) {
                          setDescriptionModalId(te.id)
                        } else {
                          setInlineEditId(te.id)
                          setInlineNotes(te.notes ?? '')
                        }
                      }}
                      className="flex-1 min-w-0 text-left text-sm text-primary-light/80 hover:text-primary-light truncate"
                    >
                      {te.notes || <span className="text-primary-light/40">Add description</span>}
                    </button>
                  )}
                </div>
              </div>

              {/* Time range + Duration + Menu */}
              <div
                className={cn(
                  'flex gap-2 shrink-0',
                  inlineTimeEditId === te.id
                    ? 'flex-col sm:flex-row sm:items-center sm:flex-nowrap'
                    : 'flex-nowrap items-center'
                )}
              >
                {/* Time range – click to edit, time only (hidden on mobile, show Edit link instead) */}
                <div className={cn('shrink-0', inlineTimeEditId === te.id && 'w-full sm:w-auto')}>
                  {inlineTimeEditId === te.id ? (
                    <div
                      className="flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0 p-2 sm:p-0 rounded-lg sm:rounded-none bg-primary-dark/50 sm:bg-transparent border border-primary-blue/30 sm:border-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex flex-row items-start gap-2">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className="text-xs font-medium text-primary-light/60">Start</span>
                          <TimeNumberInput
                            value={inlineStartTime}
                            onChange={setInlineStartTime}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className="text-xs font-medium text-primary-light/60">End</span>
                          <TimeNumberInput
                            value={inlineEndTime}
                            onChange={setInlineEndTime}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 sm:gap-1 pt-0.5 sm:pt-0 border-t border-primary-blue/20 sm:border-0">
                        <button
                          type="button"
                          onClick={() => handleInlineTimeSave(te)}
                          className="flex-1 sm:flex-none px-4 py-2 sm:px-2 sm:py-1 text-sm font-medium text-primary-dark bg-primary-gold hover:bg-primary-gold/90 rounded-lg transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setInlineTimeEditId(null)}
                          className="flex-1 sm:flex-none px-4 py-2 sm:px-2 sm:py-1 text-sm text-primary-light/80 hover:text-primary-light rounded-lg border border-primary-blue/50 hover:border-primary-blue"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginTimeEdit(te)}
                      className="text-sm text-primary-light/80 hover:text-primary-light hover:underline hidden sm:inline-block"
                    >
                      {format(new Date(te.startTime), 'h:mma')} –{' '}
                      {format(new Date(te.endTime), 'h:mma')}
                    </button>
                  )}
                </div>

                {/* Duration – click to edit, sticky colons, numbers only */}
                <div className="w-24 shrink-0 text-right">
                  {inlineDurationEditId === te.id ? (
                    <input
                      ref={durationInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={inlineDuration}
                      onChange={() => {}}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleInlineDurationSave(te)
                          return
                        }
                        if (e.key === 'Escape') {
                          setInlineDurationEditId(null)
                          return
                        }
                        const result = processDurationKey(
                          inlineDuration,
                          e.key,
                          (e.target as HTMLInputElement).selectionStart ?? 0
                        )
                        if (result) {
                          e.preventDefault()
                          setInlineDuration(result.newValue)
                          setTimeout(() => {
                            durationInputRef.current?.setSelectionRange(
                              result.newCursor,
                              result.newCursor
                            )
                          }, 0)
                        } else if (e.key >= '0' && e.key <= '9') {
                          e.preventDefault()
                        }
                      }}
                      onBlur={() => handleInlineDurationSave(te)}
                      onPaste={e => e.preventDefault()}
                      placeholder="00:00:00"
                      className="w-full text-sm font-medium text-primary-light bg-transparent px-2 py-1 text-right focus:outline-none focus:ring-0 font-mono tabular-nums"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginDurationEdit(te)}
                      className="text-sm font-medium text-primary-light hover:text-primary-gold hover:underline w-full text-right"
                    >
                      {formatDuration(te)}
                    </button>
                  )}
                </div>

                {/* Kebab menu – Edit times + Delete */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={e => {
                      menuButtonRef.current = e.currentTarget
                      setOpenMenuId(openMenuId === te.id ? null : te.id)
                    }}
                    className="p-1 rounded hover:bg-primary-dark text-primary-light/60 hover:text-primary-light"
                    aria-label="More options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {openMenuId === te.id &&
                    createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-[100]"
                          onClick={() => setOpenMenuId(null)}
                          aria-hidden
                        />
                        <div
                          className="fixed z-[101] py-1 rounded-lg bg-primary-dark-secondary border border-primary-blue shadow-xl min-w-[140px]"
                          style={
                            menuButtonRef.current
                              ? (() => {
                                  const rect = menuButtonRef.current.getBoundingClientRect()
                                  return {
                                    top: rect.bottom + 4,
                                    right: window.innerWidth - rect.right,
                                  }
                                })()
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              beginTimeEdit(te)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-primary-light hover:bg-primary-blue/10"
                          >
                            Edit times
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              handleDeleteClick(te.id)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      </>,
                      document.body
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Time Entry"
        message="Are you sure you want to delete this time entry?"
        confirmText="Delete"
        confirmVariant="danger"
      />

      {(() => {
        const te = descriptionModalId ? timeEntries.find(t => t.id === descriptionModalId) : null
        const handleModalClose = () => {
          setDescriptionModalId(null)
          setDescriptionModalEditing(false)
        }
        const handleEditClick = () => {
          setModalEditNotes(te?.notes ?? '')
          setDescriptionModalEditing(true)
        }
        const handleModalSave = async () => {
          if (!te) return
          try {
            await updateTimeEntry(te.id, { notes: modalEditNotes || undefined }, jobLogId)
            setDescriptionModalEditing(false)
          } catch (e) {
            console.error(e)
          }
        }
        const displayNotes = descriptionModalEditing ? modalEditNotes : (te?.notes ?? '')
        return (
          <Modal
            isOpen={descriptionModalId !== null}
            onClose={handleModalClose}
            title="Description"
            headerRight={
              te && `${format(new Date(te.startTime), 'h:mma')} – ${format(new Date(te.endTime), 'h:mma')}`
            }
            footer={
              descriptionModalEditing ? (
                <Button size="sm" onClick={handleModalSave}>
                  Save
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  Edit
                </Button>
              )
            }
          >
            <textarea
              ref={modalTextareaRef}
              value={displayNotes}
              onChange={e => setModalEditNotes(e.target.value)}
              readOnly={!descriptionModalEditing}
              placeholder="Add description"
              className="w-full min-h-[80px] p-0 bg-transparent text-primary-light placeholder:text-primary-light/40 focus:outline-none border-none resize-none whitespace-pre-wrap text-base"
              style={{ font: 'inherit' }}
            />
          </Modal>
        )
      })()}
    </div>
  )
}

export default TimeTracker
