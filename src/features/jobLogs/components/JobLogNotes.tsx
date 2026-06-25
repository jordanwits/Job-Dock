import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useJobLogStore } from '../store/jobLogStore'
import type { JobLogNoteEntry } from '../types/jobLog'
import { parseNotes, serializeNotes } from '../utils/notesUtils'
import { AppButton, DateField, TextAreaField } from './jobLogsUi'

interface JobLogNotesProps {
  jobLogId: string
  initialNotes?: string
}

const JobLogNotes = ({ jobLogId, initialNotes = '' }: JobLogNotesProps) => {
  const { updateJobLog } = useJobLogStore()
  const [entries, setEntries] = useState<JobLogNoteEntry[]>(() => parseNotes(initialNotes))
  const [isSaving, setIsSaving] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isAddMode, setIsAddMode] = useState(false)

  useEffect(() => {
    setEntries(parseNotes(initialNotes))
  }, [initialNotes])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateJobLog(jobLogId, { notes: serializeNotes(entries) })
      setIsCollapsed(true)
      setIsAddMode(false)
    } finally {
      setIsSaving(false)
    }
  }

  const updateEntry = (index: number, updates: Partial<JobLogNoteEntry>) => {
    setEntries(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const addEntry = () => {
    setIsAddMode(true)
    setIsCollapsed(false)
    setEntries(prev => [...prev, { text: '', date: format(new Date(), 'yyyy-MM-dd') }])
  }

  const expandToEditAll = () => {
    setIsAddMode(false)
    setIsCollapsed(false)
  }

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  const handleCancel = () => {
    setEntries(parseNotes(initialNotes))
    setIsCollapsed(true)
    setIsAddMode(false)
  }

  const hasChanges = serializeNotes(entries) !== serializeNotes(parseNotes(initialNotes))
  const savedEntries = parseNotes(initialNotes)
  const hasEntries = savedEntries.length > 0

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number)
      return format(new Date(y, m - 1, d), 'MMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  const truncate = (text: string, maxLen: number) =>
    text.length <= maxLen ? text : text.slice(0, maxLen) + '...'

  if (isCollapsed && hasEntries && !hasChanges) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium text-ink">Notes</h5>
          <AppButton type="button" size="sm" variant="subtle" onClick={addEntry}>
            Add entry
          </AppButton>
        </div>
        <ul className="space-y-2">
          {savedEntries.map((entry, index) => (
            <li
              key={index}
              role="button"
              tabIndex={0}
              onClick={expandToEditAll}
              onKeyDown={e => e.key === 'Enter' && expandToEditAll()}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{truncate(entry.text, 120)}</p>
                {entry.date && (
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-subtle">{formatDate(entry.date)}</p>
                )}
              </div>
              <span className="shrink-0 text-ink-subtle">Edit</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (isAddMode && hasEntries) {
    const newEntries = entries.slice(savedEntries.length)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium text-ink">Notes</h5>
          <AppButton type="button" size="sm" variant="subtle" onClick={addEntry}>
            Add entry
          </AppButton>
        </div>
        <ul className="space-y-2">
          {savedEntries.map((entry, index) => (
            <li
              key={index}
              role="button"
              tabIndex={0}
              onClick={expandToEditAll}
              onKeyDown={e => e.key === 'Enter' && expandToEditAll()}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{truncate(entry.text, 120)}</p>
                {entry.date && (
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-subtle">{formatDate(entry.date)}</p>
                )}
              </div>
              <span className="shrink-0 text-ink-subtle">Edit</span>
            </li>
          ))}
        </ul>
        {newEntries.map((newEntry, i) => {
          const index = savedEntries.length + i
          return (
            <div
              key={index}
              className="space-y-2 rounded-lg border border-line bg-surface-2 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <TextAreaField
                    value={newEntry.text}
                    onChange={e => updateEntry(index, { text: e.target.value })}
                    placeholder="Note content..."
                    rows={2}
                    className="min-h-0 resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full min-w-0">
                      <DateField
                        label="Date (optional)"
                        value={newEntry.date ?? ''}
                        onChange={date => updateEntry(index, { date: date || undefined })}
                        placeholder="Select date"
                      />
                    </div>
                    {newEntry.date && (
                      <AppButton
                        size="sm"
                        variant="ghost"
                        onClick={() => updateEntry(index, { date: undefined })}
                      >
                        Clear date
                      </AppButton>
                    )}
                  </div>
                </div>
                <AppButton
                  size="sm"
                  variant="dangerGhost"
                  onClick={() => removeEntry(index)}
                  className="shrink-0"
                >
                  Remove
                </AppButton>
              </div>
            </div>
          )
        })}
        <div className="flex gap-2">
          <AppButton size="sm" onClick={handleSave} disabled={isSaving} isLoading={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
          <AppButton size="sm" variant="subtle" onClick={handleCancel}>
            Cancel
          </AppButton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium text-ink">Notes</h5>
        <AppButton size="sm" variant="subtle" onClick={addEntry}>
          Add entry
        </AppButton>
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div
            key={index}
            className="space-y-2 rounded-lg border border-line bg-surface-2 p-3"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <TextAreaField
                  value={entry.text}
                  onChange={e => updateEntry(index, { text: e.target.value })}
                  placeholder="Note content..."
                  rows={2}
                  className="min-h-0 resize-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-full min-w-0">
                    <DateField
                      label="Date (optional)"
                      value={entry.date ?? ''}
                      onChange={date => updateEntry(index, { date: date || undefined })}
                      placeholder="Select date"
                    />
                  </div>
                  {entry.date && (
                    <AppButton
                      size="sm"
                      variant="ghost"
                      onClick={() => updateEntry(index, { date: undefined })}
                    >
                      Clear date
                    </AppButton>
                  )}
                </div>
              </div>
              <AppButton
                size="sm"
                variant="dangerGhost"
                onClick={() => removeEntry(index)}
                className="shrink-0"
              >
                Remove
              </AppButton>
            </div>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="py-4 text-sm text-ink-subtle">
          No notes yet. Add an entry to get started.
        </p>
      )}

      {(hasChanges || entries.length > 0) && (
        <div className="flex gap-2">
          {hasChanges && (
            <AppButton size="sm" onClick={handleSave} disabled={isSaving} isLoading={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </AppButton>
          )}
          <AppButton size="sm" variant="subtle" onClick={handleCancel}>
            Cancel
          </AppButton>
        </div>
      )}
    </div>
  )
}

export default JobLogNotes
