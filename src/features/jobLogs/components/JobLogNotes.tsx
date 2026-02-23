import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button, DatePicker, Textarea } from '@/components/ui'
import { useJobLogStore } from '../store/jobLogStore'
import type { JobLogNoteEntry } from '../types/jobLog'
import { parseNotes, serializeNotes } from '../utils/notesUtils'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface JobLogNotesProps {
  jobLogId: string
  initialNotes?: string
}

const JobLogNotes = ({ jobLogId, initialNotes = '' }: JobLogNotesProps) => {
  const { theme } = useTheme()
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
          <h5 className={cn(
            "text-sm font-medium",
            theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightText'
          )}>Notes</h5>
          <Button type="button" size="sm" variant="outline" onClick={addEntry}>
            Add entry
          </Button>
        </div>
        <ul className="space-y-2">
          {savedEntries.map((entry, index) => (
            <li
              key={index}
              role="button"
              tabIndex={0}
              onClick={expandToEditAll}
              onKeyDown={e => e.key === 'Enter' && expandToEditAll()}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                theme === 'dark'
                  ? 'border-primary-blue/50 bg-primary-dark/30 hover:bg-primary-dark/50'
                  : 'border-gray-200/20 bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm truncate",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{truncate(entry.text, 120)}</p>
                {entry.date && (
                  <p className={cn(
                    "text-xs mt-0.5",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>{formatDate(entry.date)}</p>
                )}
              </div>
              <span className={cn(
                "shrink-0",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>Edit</span>
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
          <h5 className={cn(
            "text-sm font-medium",
            theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightText'
          )}>Notes</h5>
          <Button type="button" size="sm" variant="outline" onClick={addEntry}>
            Add entry
          </Button>
        </div>
        <ul className="space-y-2">
          {savedEntries.map((entry, index) => (
            <li
              key={index}
              role="button"
              tabIndex={0}
              onClick={expandToEditAll}
              onKeyDown={e => e.key === 'Enter' && expandToEditAll()}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                theme === 'dark'
                  ? 'border-primary-blue/50 bg-primary-dark/30 hover:bg-primary-dark/50'
                  : 'border-gray-200/20 bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm truncate",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{truncate(entry.text, 120)}</p>
                {entry.date && (
                  <p className={cn(
                    "text-xs mt-0.5",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                  )}>{formatDate(entry.date)}</p>
                )}
              </div>
              <span className={cn(
                "shrink-0",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>Edit</span>
            </li>
          ))}
        </ul>
        {newEntries.map((newEntry, i) => {
          const index = savedEntries.length + i
          return (
            <div
              key={index}
              className={cn(
                "space-y-2 rounded-lg border p-3",
                theme === 'dark'
                  ? 'border-primary-blue/50 bg-primary-dark/30'
                  : 'border-gray-200/20 bg-gray-50'
              )}
            >
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0 space-y-2">
                  <Textarea
                    value={newEntry.text}
                    onChange={e => updateEntry(index, { text: e.target.value })}
                    placeholder="Note content..."
                    rows={2}
                    className="resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full min-w-0">
                      <DatePicker
                        label="Date (optional)"
                        value={newEntry.date ?? ''}
                        onChange={date => updateEntry(index, { date: date || undefined })}
                        placeholder="Select date"
                      />
                    </div>
                    {newEntry.date && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateEntry(index, { date: undefined })}
                        className={theme === 'dark' ? 'text-primary-light/60 hover:text-primary-light' : 'text-primary-lightTextSecondary hover:text-primary-lightText'}
                      >
                        Clear date
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeEntry(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                >
                  Remove
                </Button>
              </div>
            </div>
          )
        })}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className={cn(
          "text-sm font-medium",
          theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightText'
        )}>Notes</h5>
        <Button size="sm" variant="outline" onClick={addEntry}>
          Add entry
        </Button>
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div
            key={index}
            className={cn(
              "space-y-2 rounded-lg border p-3",
              theme === 'dark'
                ? 'border-primary-blue/50 bg-primary-dark/30'
                : 'border-gray-200/20 bg-gray-50'
            )}
          >
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0 space-y-2">
                <Textarea
                  value={entry.text}
                  onChange={e => updateEntry(index, { text: e.target.value })}
                  placeholder="Note content..."
                  rows={2}
                  className="resize-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-full min-w-0">
                    <DatePicker
                      label="Date (optional)"
                      value={entry.date ?? ''}
                      onChange={date => updateEntry(index, { date: date || undefined })}
                      placeholder="Select date"
                    />
                  </div>
                  {entry.date && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateEntry(index, { date: undefined })}
                      className={theme === 'dark' ? 'text-primary-light/60 hover:text-primary-light' : 'text-primary-lightTextSecondary hover:text-primary-lightText'}
                    >
                      Clear date
                    </Button>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeEntry(index)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className={cn(
          "text-sm py-4",
          theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
        )}>
          No notes yet. Add an entry to get started.
        </p>
      )}

      {(hasChanges || entries.length > 0) && (
        <div className="flex gap-2">
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

export default JobLogNotes
