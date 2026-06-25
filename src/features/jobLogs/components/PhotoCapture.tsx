import { useRef, useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { JobLogPhoto, MarkupStroke, MarkupPoint } from '../types/jobLog'
import { useJobLogStore } from '../store/jobLogStore'
import { Alert, AlertIcon, AppButton, AppModal, CameraIcon, TextAreaField, TrashIcon, XIcon } from './jobLogsUi'

function formatPhotoTimestamp(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return format(d, 'MMM d, yyyy • h:mm a')
}

interface PhotoCaptureProps {
  jobLogId: string
  photos: JobLogPhoto[]
}

const PhotoCapture = ({ jobLogId, photos }: PhotoCaptureProps) => {
  const { uploadPhoto, updatePhoto, deletePhoto } = useJobLogStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [fullscreenPhoto, setFullscreenPhoto] = useState<JobLogPhoto | null>(null)
  const [notes, setNotes] = useState('')
  const [strokes, setStrokes] = useState<MarkupStroke[]>([])
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser' | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeStroke, setActiveStroke] = useState<MarkupStroke | null>(null)
  const isPointerDownRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingPointRef = useRef<MarkupPoint | null>(null)
  const lastEraserPosRef = useRef<MarkupPoint | null>(null)
  const [loadedThumbnails, setLoadedThumbnails] = useState<Set<string>>(new Set())

  const handleThumbnailLoad = useCallback((photoId: string) => {
    setLoadedThumbnails((prev) => new Set(prev).add(photoId))
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    setUploading(true)
    try {
      await uploadPhoto(jobLogId, file)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const getStrokesFromPhoto = (photo: JobLogPhoto): MarkupStroke[] => {
    return photo.markup?.strokes ?? []
  }

  useEffect(() => {
    if (fullscreenPhoto && photos.length > 0) {
      const updated = photos.find((p) => p.id === fullscreenPhoto.id)
      if (updated) {
        setFullscreenPhoto(updated)
        setNotes(updated.notes ?? '')
        setStrokes(getStrokesFromPhoto(updated))
      }
    }
  }, [photos])

  const openFullscreen = useCallback((photo: JobLogPhoto) => {
    setFullscreenPhoto(photo)
    setNotes(photo.notes ?? '')
    setStrokes(getStrokesFromPhoto(photo))
    setActiveTool(null)
    setSaveError(null)
  }, [])

  const closeFullscreen = useCallback(() => {
    setFullscreenPhoto(null)
    setActiveTool(null)
    setActiveStroke(null)
    isPointerDownRef.current = false
    pendingPointRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen()
    }
    if (fullscreenPhoto) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [fullscreenPhoto, closeFullscreen])

  const [saveError, setSaveError] = useState<string | null>(null)
  const [photoToDelete, setPhotoToDelete] = useState<JobLogPhoto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePhoto(jobLogId, photoToDelete.id)
      setPhotoToDelete(null)
      if (fullscreenPhoto?.id === photoToDelete.id) {
        closeFullscreen()
      }
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : 'Failed to delete photo'
      setDeleteError(message || 'Failed to delete photo')
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!fullscreenPhoto) return
    setSaving(true)
    setSaveError(null)
    try {
      await updatePhoto(jobLogId, fullscreenPhoto.id, {
        notes: notes.trim(),
        markup: { strokes },
      })
      closeFullscreen()
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to save')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const getNormalizedCoords = (clientX: number, clientY: number): MarkupPoint => {
    const rect = imgContainerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
  }

  const pathFromPoints = (points: MarkupPoint[]) => {
    if (points.length === 0) return ''
    const [first, ...rest] = points
    return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`
  }

  const ERASER_RADIUS = 0.065
  const ERASER_SAMPLE_SPACING = 0.008
  const MIN_SEGMENT_LENGTH = 0.02

  const distToSegment = (p: MarkupPoint, a: MarkupPoint, b: MarkupPoint): number => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const qx = a.x + t * dx
    const qy = a.y + t * dy
    return Math.hypot(p.x - qx, p.y - qy)
  }

  const segmentCircleIntersections = (
    a: MarkupPoint,
    b: MarkupPoint,
    center: MarkupPoint,
    r: number
  ): { t: number }[] => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const ex = a.x - center.x
    const ey = a.y - center.y
    const A = dx * dx + dy * dy
    const B = 2 * (ex * dx + ey * dy)
    const C = ex * ex + ey * ey - r * r
    const disc = B * B - 4 * A * C
    if (disc < 0) return []
    const sqrtDisc = Math.sqrt(disc)
    const t1 = (-B - sqrtDisc) / (2 * A)
    const t2 = (-B + sqrtDisc) / (2 * A)
    const out: { t: number }[] = []
    if (t1 >= 0 && t1 <= 1) out.push({ t: t1 })
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-9) out.push({ t: t2 })
    return out.sort((x, y) => x.t - y.t)
  }

  const applyEraserAt = (center: MarkupPoint, radius: number, strokesIn: MarkupStroke[]): MarkupStroke[] => {
    const result: MarkupStroke[] = []
    const inside = (p: MarkupPoint) => Math.hypot(p.x - center.x, p.y - center.y) < radius
    for (const stroke of strokesIn) {
      const pts = stroke.points
      if (pts.length < 2) continue
      const segments: MarkupPoint[][] = []
      let current: MarkupPoint[] = [pts[0]]
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const d = distToSegment(center, a, b)
        if (d >= radius) {
          current.push(b)
        } else {
          const hits = segmentCircleIntersections(a, b, center, radius)
          if (hits.length === 0) {
            current.push(b)
          } else if (hits.length === 1) {
            const t = hits[0].t
            const mx = a.x + t * (b.x - a.x)
            const my = a.y + t * (b.y - a.y)
            if (inside(a) && !inside(b)) {
              if (current.length >= 2) segments.push([...current])
              current = [{ x: mx, y: my }, b]
            } else if (!inside(a) && inside(b)) {
              current.push({ x: mx, y: my })
              if (current.length >= 2) segments.push([...current])
              current = [b]
            } else {
              current.push(b)
            }
          } else {
            const t1 = hits[0].t
            const t2 = hits[1].t
            const m1 = { x: a.x + t1 * (b.x - a.x), y: a.y + t1 * (b.y - a.y) }
            const m2 = { x: a.x + t2 * (b.x - a.x), y: a.y + t2 * (b.y - a.y) }
            if (inside(a) && inside(b)) {
              if (current.length >= 2) segments.push([...current])
              segments.push([m1, m2])
              current = [b]
            } else {
              current.push(m1)
              if (current.length >= 2) segments.push([...current])
              current = [m2, b]
            }
          }
        }
      }
      if (current.length >= 2) segments.push(current)
      for (const seg of segments) {
        if (seg.length < 2) continue
        let len = 0
        for (let j = 1; j < seg.length; j++) {
          len += Math.hypot(seg[j].x - seg[j - 1].x, seg[j].y - seg[j - 1].y)
        }
        if (len >= MIN_SEGMENT_LENGTH) {
          result.push({ ...stroke, points: seg })
        }
      }
    }
    return result
  }

  const startStroke = (tool: 'pen' | 'highlighter', start: MarkupPoint): MarkupStroke => {
    if (tool === 'highlighter') {
      return {
        tool,
        color: '#EAB308',
        opacity: 0.35,
        width: 0.035,
        points: [start],
      }
    }
    return {
      tool,
      color: '#EAB308',
      opacity: 0.9,
      width: 0.012,
      points: [start],
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!activeTool) return
    e.preventDefault()
    e.stopPropagation()
    isPointerDownRef.current = true
    imgContainerRef.current?.setPointerCapture?.(e.pointerId)

    const p = getNormalizedCoords(e.clientX, e.clientY)

    if (activeTool === 'eraser') {
      lastEraserPosRef.current = p
      setStrokes((prev) => applyEraserAt(p, ERASER_RADIUS, prev))
      return
    }

    setActiveStroke(startStroke(activeTool, p))
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeTool) return
    const p = getNormalizedCoords(e.clientX, e.clientY)

    if (activeTool === 'eraser' && isPointerDownRef.current) {
      e.preventDefault()
      e.stopPropagation()
      const last = lastEraserPosRef.current
      lastEraserPosRef.current = p
      setStrokes((prev) => {
        let s = prev
        if (last) {
          const dx = p.x - last.x
          const dy = p.y - last.y
          const dist = Math.hypot(dx, dy)
          const steps = Math.max(12, Math.ceil(dist / ERASER_SAMPLE_SPACING))
          for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const q = { x: last.x + t * dx, y: last.y + t * dy }
            s = applyEraserAt(q, ERASER_RADIUS, s)
          }
        } else {
          s = applyEraserAt(p, ERASER_RADIUS, s)
        }
        return s
      })
      return
    }

    if (activeTool === 'eraser') return
    if (!isPointerDownRef.current) return
    e.preventDefault()
    e.stopPropagation()

    pendingPointRef.current = p
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const nextPoint = pendingPointRef.current
      pendingPointRef.current = null
      if (!nextPoint) return

      setActiveStroke((prev) => {
        if (!prev) return prev
        const last = prev.points[prev.points.length - 1]
        // Reduce point spam
        if (Math.hypot(nextPoint.x - last.x, nextPoint.y - last.y) < 0.0025) return prev
        return { ...prev, points: [...prev.points, nextPoint] }
      })
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!activeTool) return
    e.preventDefault()
    e.stopPropagation()
    isPointerDownRef.current = false
    if (activeTool === 'eraser') lastEraserPosRef.current = null

    pendingPointRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    setActiveStroke((stroke) => {
      if (!stroke) return null
      if (stroke.points.length >= 2) {
        setStrokes((prev) => [...prev, stroke])
      }
      return null
    })
  }

  const undo = () => {
    setStrokes((prev) => prev.slice(0, -1))
  }

  const clearMarkup = () => {
    setStrokes([])
  }

  const fullscreenCapturedAt = fullscreenPhoto
    ? formatPhotoTimestamp(fullscreenPhoto.createdAt)
    : null

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <AppButton
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        isLoading={uploading}
      >
        {!uploading && <CameraIcon className="h-4 w-4" />}
        {uploading ? 'Uploading...' : 'Add Photo'}
      </AppButton>
      {photos && photos.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {photos.map((p) => {
            const isLoaded = loadedThumbnails.has(p.id)
            const capturedAt = formatPhotoTimestamp(p.createdAt)
            return (
              <div
                key={p.id}
                className="flex w-full min-w-0 flex-col gap-1"
              >
                <div className="group relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
                <button
                  type="button"
                  onClick={() => openFullscreen(p)}
                  className="absolute inset-0 h-full w-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {!isLoaded && (
                  <div
                    className="absolute inset-0 overflow-hidden bg-surface-2"
                    aria-hidden
                  >
                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
                  </div>
                )}
                <img
                  src={p.url}
                  alt={p.fileName}
                  className={cn('h-full w-full object-cover transition-opacity duration-150', isLoaded ? 'opacity-100' : 'opacity-0')}
                  onLoad={() => handleThumbnailLoad(p.id)}
                />
                {isLoaded && (getStrokesFromPhoto(p).length > 0) && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                  >
                    {getStrokesFromPhoto(p).map((s, i) => (
                      <path
                        key={i}
                        d={pathFromPoints(s.points)}
                        fill="none"
                        stroke={s.color}
                        strokeOpacity={s.opacity}
                        strokeWidth={Math.max(s.width * 2.5, 0.03)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </svg>
                )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPhotoToDelete(p)
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-danger hover:text-white focus:opacity-100 focus:outline-none group-hover:opacity-100"
                  aria-label="Delete photo"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                </div>
                {capturedAt && (
                  <p className="font-mono text-xs tabular-nums text-ink-subtle">{capturedAt}</p>
                )}
                {p.notes && (
                  <p className="line-clamp-2 break-words text-sm text-ink-muted">{p.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 touch-manipulation"
          onClick={(e) => e.target === e.currentTarget && closeFullscreen()}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={closeFullscreen}
            aria-label="Close"
          >
            <XIcon className="h-6 w-6" />
          </button>

          <div
            className="flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {fullscreenCapturedAt && (
              <p className="w-full text-center font-mono text-sm tabular-nums text-white/55">
                {fullscreenCapturedAt}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <MarkupToolButton active={activeTool === 'pen'} onClick={() => setActiveTool(activeTool === 'pen' ? null : 'pen')}>
                Pen
              </MarkupToolButton>
              <MarkupToolButton active={activeTool === 'highlighter'} onClick={() => setActiveTool(activeTool === 'highlighter' ? null : 'highlighter')}>
                Highlighter
              </MarkupToolButton>
              <MarkupToolButton active={activeTool === 'eraser'} tone="danger" onClick={() => setActiveTool(activeTool === 'eraser' ? null : 'eraser')}>
                Eraser
              </MarkupToolButton>
              <MarkupToolButton onClick={undo} disabled={strokes.length === 0}>
                Undo
              </MarkupToolButton>
              <MarkupToolButton onClick={clearMarkup} disabled={strokes.length === 0}>
                Clear
              </MarkupToolButton>
              <MarkupToolButton tone="danger" onClick={() => fullscreenPhoto && setPhotoToDelete(fullscreenPhoto)}>
                Delete
              </MarkupToolButton>
            </div>

            <div
              ref={imgContainerRef}
              className={cn('relative flex-shrink-0', activeTool && 'cursor-crosshair touch-none')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={fullscreenPhoto.url}
                alt={fullscreenPhoto.fileName}
                className="max-w-full max-h-[60vh] object-contain select-none pointer-events-none"
                draggable={false}
              />
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                {strokes.map((s, i) => (
                  <path
                    key={i}
                    d={pathFromPoints(s.points)}
                    fill="none"
                    stroke={s.color}
                    strokeOpacity={s.opacity}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {activeStroke && (
                  <path
                    d={pathFromPoints(activeStroke.points)}
                    fill="none"
                    stroke={activeStroke.color}
                    strokeOpacity={activeStroke.opacity}
                    strokeWidth={activeStroke.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>

            <div className="w-full max-w-2xl space-y-2 rounded-xl bg-surface p-4 shadow-pop">
              {saveError && (
                <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>{saveError}</Alert>
              )}
              <TextAreaField
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onFocus={(e) => {
                  e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }}
                placeholder="Add notes about this photo..."
                rows={3}
                className="text-base"
              />
              <AppButton
                size="sm"
                onClick={handleSave}
                disabled={saving}
                isLoading={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </AppButton>
            </div>
          </div>
        </div>
      )}

      <AppModal
        isOpen={!!photoToDelete}
        onClose={() => {
          if (!deleting) {
            setPhotoToDelete(null)
            setDeleteError(null)
          }
        }}
        title="Delete photo"
        size="sm"
        footer={
          <>
            <AppButton
              variant="ghost"
              onClick={() => {
                setPhotoToDelete(null)
                setDeleteError(null)
              }}
              disabled={deleting}
            >
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleDeletePhoto} isLoading={deleting} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          {deleteError && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>{deleteError}</Alert>
          )}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertIcon className="h-5 w-5" />
            </span>
            <p className="text-sm leading-relaxed text-ink-muted">
              Are you sure you want to delete this photo? This cannot be undone.
            </p>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

/* Markup toolbar button — token chrome over the dark lightbox backdrop. */
function MarkupToolButton({
  active = false,
  tone = 'accent',
  disabled = false,
  onClick,
  children,
}: {
  active?: boolean
  tone?: 'accent' | 'danger'
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const activeCls =
    tone === 'danger'
      ? 'bg-danger-soft text-danger ring-danger/50'
      : 'bg-accent-soft text-accent-strong ring-accent'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold ring-1 ring-inset transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        active
          ? activeCls
          : tone === 'danger'
            ? 'bg-white/10 text-danger ring-white/20 hover:bg-white/20'
            : 'bg-white/10 text-white ring-white/20 hover:bg-white/20'
      )}
    >
      {children}
    </button>
  )
}

export default PhotoCapture
