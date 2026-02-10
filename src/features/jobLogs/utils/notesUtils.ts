import type { JobLogNoteEntry } from '../types/jobLog'

export function parseNotes(notes: string | undefined): JobLogNoteEntry[] {
  if (!notes?.trim()) return []
  const trimmed = notes.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (e): e is JobLogNoteEntry =>
            typeof e === 'object' && e !== null && typeof (e as JobLogNoteEntry).text === 'string'
        ).map((e) => ({
          text: (e as JobLogNoteEntry).text,
          date: (e as JobLogNoteEntry).date,
        }))
      }
    } catch {
      // fall through to legacy
    }
  }
  return [{ text: trimmed }]
}

export function serializeNotes(entries: JobLogNoteEntry[]): string {
  const filtered = entries.filter((e) => e.text.trim())
  if (filtered.length === 0) return ''
  return JSON.stringify(filtered)
}

export function getNotesPreview(notes: string | undefined): string {
  const entries = parseNotes(notes)
  if (entries.length === 0) return ''
  if (entries.length === 1) return entries[0].text
  return entries.map((e) => e.text).join(' · ')
}
