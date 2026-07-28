/**
 * Client-side image downscaling for uploads.
 *
 * Logos and job-log photos are PUT straight to S3 from the browser with a presigned URL,
 * so whatever the file picker hands us is exactly what we store and what we pay to serve
 * back on every view. A phone camera file is 3-12 MB; capping the long edge before upload
 * cuts storage and egress by roughly 90% and keeps images clear of the API Gateway
 * response ceiling that the photo proxy has to squeeze them through.
 */

/** Long-edge cap for job-log photos. Comfortably above any size we display. */
export const PHOTO_MAX_EDGE = 2048

/** Long-edge cap for company logos (rendered at ~200px on invoices, quotes and emails). */
export const LOGO_MAX_EDGE = 1024

/** Hard ceiling on a photo before we even attempt to decode it. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024

/** Hard ceiling on a logo. Downscaling handles the rest. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024

/** The types the backend accepts for job-log photos (dataService.getUploadUrl). */
export const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

/** The types the backend accepts for logos. SVG is allowed but never re-encoded. */
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']

/** Raster formats a canvas round-trip can safely re-encode. */
const RE_ENCODABLE = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export class ImageTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`That image is too large. Please choose a file under ${formatBytes(limitBytes)}.`)
    this.name = 'ImageTooLargeError'
  }
}

export class ImageDecodeError extends Error {
  constructor() {
    super(
      "That image couldn't be read. Please try a different file, or re-save it as a JPEG or PNG."
    )
    this.name = 'ImageDecodeError'
  }
}

export interface DownscaleOptions {
  /** Longest edge of the output, in pixels. Smaller images are never upscaled. */
  maxEdge: number
  /** Reject the source outright above this many bytes. */
  maxBytes: number
  /** JPEG quality, 0-1. Ignored when the output stays PNG. */
  quality?: number
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // `imageOrientation: 'from-image'` applies the EXIF rotation phone cameras rely on.
  // Without it, portrait photos come back sideways once drawn to a canvas.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Older Safari rejects the options bag; fall through to the <img> path, which
      // applies EXIF orientation itself in every browser we support.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new ImageDecodeError())
      img.src = url
    })
  } finally {
    // Safe once the image has decoded (or failed) — the bitmap no longer needs the blob.
    URL.revokeObjectURL(url)
  }
}

function withExtension(filename: string, mimeType: string): string {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const base = filename.replace(/\.[^.]+$/, '') || 'image'
  return `${base}.${ext}`
}

/**
 * Shrink an image to `maxEdge` on its longest side, returning a new File ready to upload.
 *
 * Returns the original file untouched when it is already small enough, is a format a
 * canvas cannot faithfully round-trip (SVG), or when re-encoding would make it bigger.
 * Throws ImageTooLargeError / ImageDecodeError, both of which carry user-facing messages.
 */
export async function downscaleImage(file: File, options: DownscaleOptions): Promise<File> {
  const { maxEdge, maxBytes, quality = 0.82 } = options

  if (file.size > maxBytes) {
    throw new ImageTooLargeError(maxBytes)
  }

  // SVG is vector and GIF may be animated: both lose more than they save on a canvas
  // round-trip, so pass them through and let the size ceiling above do the work.
  if (!RE_ENCODABLE.includes(file.type.toLowerCase())) {
    return file
  }

  const bitmap = await loadBitmap(file)
  const longestEdge = Math.max(bitmap.width, bitmap.height)

  const release = () => {
    if ('close' in bitmap) bitmap.close()
  }

  // Already small enough — re-encoding would only cost quality.
  if (longestEdge <= maxEdge || longestEdge === 0) {
    release()
    return file
  }

  const scale = maxEdge / longestEdge
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    release()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  release()

  // Keep PNG as PNG so logo transparency survives; everything else becomes JPEG.
  const outType = file.type.toLowerCase() === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, outType, outType === 'image/jpeg' ? quality : undefined)
  })

  // A heavily-compressed source can re-encode larger than it started; keep the smaller one,
  // since bytes are what we store and pay to serve.
  if (!blob || blob.size >= file.size) {
    return file
  }

  return new File([blob], withExtension(file.name, outType), {
    type: outType,
    lastModified: file.lastModified,
  })
}
