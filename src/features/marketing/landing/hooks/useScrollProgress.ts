import { useEffect, useRef } from 'react'
import { subscribeToScroll } from './scrollEngine'

type ProgressMode = 'enter-exit' | 'sticky'

/**
 * Reports a normalised 0→1 progress value for a target element as it moves through the
 * viewport. The callback fires per animation frame and should mutate the DOM imperatively
 * (do NOT call setState every frame). Returns a ref to attach to the measured element.
 *
 * - `enter-exit` (default): 0 when the element's top hits the bottom of the viewport,
 *   1 when its bottom passes the top. Good for floating/parallax subjects.
 * - `sticky`: 0 when a tall wrapper becomes pinned, 1 just before it unpins. Use on the
 *   tall wrapper of a `position: sticky` scrollytelling stage.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(
  onProgress: (progress: number) => void,
  mode: ProgressMode = 'enter-exit',
  /** When false, no subscription is made. Changing this re-runs the effect so a ref that
   *  attaches on a later render (e.g. a conditionally-rendered target) subscribes correctly. */
  enabled = true
) {
  const ref = useRef<T>(null)
  const cbRef = useRef(onProgress)
  cbRef.current = onProgress

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const update = (_scrollY: number, viewportH: number) => {
      const rect = el.getBoundingClientRect()
      let p: number
      if (mode === 'sticky') {
        p = -rect.top / Math.max(1, rect.height - viewportH)
      } else {
        p = (viewportH - rect.top) / (rect.height + viewportH)
      }
      cbRef.current(p < 0 ? 0 : p > 1 ? 1 : p)
    }

    const unsubscribe = subscribeToScroll(update)
    return unsubscribe
  }, [mode, enabled])

  return ref
}
