/**
 * Lightweight cross-component data-change signal.
 *
 * When the assistant (or anything else) mutates data, it emits the affected
 * entity here; a single listener (DataRefreshListener) refetches the matching
 * Zustand store so every mounted page updates without a manual reload.
 */
export type DataEntity = 'contacts' | 'jobs' | 'quotes' | 'invoices' | 'services'

const EVENT = 'jobdock:data-changed'

export function emitDataChanged(entity: DataEntity): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { entity } }))
}

/** Subscribe to data-change events. Returns an unsubscribe function. */
export function onDataChanged(handler: (entity: DataEntity) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const fn = (e: Event) => handler((e as CustomEvent).detail?.entity)
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
