import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button, Input, ConfirmationDialog } from '@/components/ui'
import type { TimeEntry } from '../types/jobLog'
import { useJobLogStore } from '../store/jobLogStore'

const DIGIT_POSITIONS = [0, 1, 3, 4, 6, 7] // HH:MM:SS - indices for digits

function processDurationKey(
  value: string,
  key: string,
  cursorPos: number
): { newValue: string; newCursor: number } | null {
  const getDigitIndex = (pos: number) => {
    const idx = DIGIT_POSITIONS.findIndex((p) => p >= pos)
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
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const parts = value ? value.split(':') : ['', '']
  const h24 = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0))
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  const isPM = h24 >= 12
  const setFrom12h = (hour12: number, pm: boolean) => {
    const h24new = pm ? (hour12 === 12 ? 12 : hour12 + 12) : (hour12 === 12 ? 0 : hour12)
    onChange(`${h24new}`.padStart(2, '0') + ':' + `${m}`.padStart(2, '0'))
  }
  const setH = (v: number) => setFrom12h(Math.min(12, Math.max(1, v)), isPM)
  const setM = (v: number) => onChange(`${h24}`.padStart(2, '0') + ':' + `${Math.min(59, Math.max(0, v))}`.padStart(2, '0'))
  const toggleAMPM = () => setFrom12h(h12, !isPM)
  const base = 'h-10 rounded-lg border border-primary-blue bg-primary-dark-secondary px-2 py-1 text-sm text-primary-light focus:outline-none focus:ring-2 focus:ring-primary-gold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        min={1}
        max={12}
        value={h12}
        onChange={(e) => setH(parseInt(e.target.value, 10) || 1)}
        className={cn(base, 'w-10')}
        placeholder="hr"
      />
      <span className="text-primary-light/50">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={m}
        onChange={(e) => setM(parseInt(e.target.value, 10) || 0)}
        className={cn(base, 'w-10')}
        placeholder="min"
      />
      <button
        type="button"
        onClick={toggleAMPM}
        className={cn(base, 'w-10 px-1 text-xs font-medium', isPM ? 'text-primary-gold' : 'text-primary-light/70')}
      >
        {isPM ? 'PM' : 'AM'}
      </button>
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
  const durationInputRef = useRef<HTMLInputElement>(null)

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
    const parts = str.trim().split(':').map((p) => parseInt(p, 10))
    if (parts.some((n) => isNaN(n))) return null
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
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
        jobLogId,
        startTime: start.toISOString(),
      }))
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
      await updateTimeEntry(te.id, {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      }, jobLogId)
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
      await updateTimeEntry(te.id, {
        endTime: newEnd.toISOString(),
      }, jobLogId)
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
      <div className="flex flex-wrap items-center gap-4">
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
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-primary-dark/30 border border-primary-blue/30 hover:bg-primary-dark/40 transition-colors"
            >
              {/* Index */}
              <div className="w-8 h-8 flex items-center justify-center rounded border border-primary-blue/50 bg-primary-dark/50 text-xs font-medium text-primary-light/80 shrink-0">
                {index + 1}
              </div>

              {/* Job title + Description / Notes */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-semibold text-base text-primary-light shrink-0">
                  {jobLogTitle}
                </span>
                <span className="text-primary-light/50 shrink-0">–</span>
                {inlineEditId === te.id ? (
                  <input
                    type="text"
                    value={inlineNotes}
                    onChange={(e) => setInlineNotes(e.target.value)}
                    onBlur={() => handleInlineNotesSave(te)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInlineNotesSave(te)}
                    placeholder="Add description"
                    className="flex-1 min-w-0 bg-transparent text-sm text-primary-light placeholder:text-primary-light/40 focus:outline-none focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setInlineEditId(te.id)
                      setInlineNotes(te.notes ?? '')
                    }}
                    className="flex-1 min-w-0 text-left text-sm text-primary-light/80 hover:text-primary-light truncate"
                  >
                    {te.notes || <span className="text-primary-light/40">Add description</span>}
                  </button>
                )}
              </div>

              {/* Time range – click to edit, time only */}
              <div className="shrink-0">
                {inlineTimeEditId === te.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <TimeNumberInput
                      value={inlineStartTime}
                      onChange={setInlineStartTime}
                    />
                    <span className="text-primary-light/50">–</span>
                    <TimeNumberInput
                      value={inlineEndTime}
                      onChange={setInlineEndTime}
                    />
                    <button
                      type="button"
                      onClick={() => handleInlineTimeSave(te)}
                      className="text-xs text-primary-gold hover:underline px-1"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineTimeEditId(null)}
                      className="text-xs text-primary-light/60 hover:text-primary-light px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => beginTimeEdit(te)}
                    className="text-sm text-primary-light/80 hover:text-primary-light hover:underline"
                  >
                    {format(new Date(te.startTime), 'h:mma')} – {format(new Date(te.endTime), 'h:mma')}
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
                    onKeyDown={(e) => {
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
                    onPaste={(e) => e.preventDefault()}
                    placeholder="00:00:00"
                    className="w-full text-sm font-medium text-primary-light bg-primary-dark border border-primary-blue rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-primary-gold font-mono tabular-nums"
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

              {/* Kebab menu – Delete only */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(openMenuId === te.id ? null : te.id)}
                  className="p-1 rounded hover:bg-primary-dark text-primary-light/60 hover:text-primary-light"
                  aria-label="More options"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {openMenuId === te.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                      aria-hidden
                    />
                    <div className="absolute right-0 top-full mt-1 py-1 rounded-lg bg-primary-dark-secondary border border-primary-blue shadow-xl z-20 min-w-[100px]">
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
                  </>
                )}
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
    </div>
  )
}

export default TimeTracker
