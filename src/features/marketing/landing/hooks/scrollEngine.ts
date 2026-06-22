/**
 * A single shared scroll/resize ticker for all landing-page parallax + scroll-progress
 * subscribers. One passive scroll listener + one requestAnimationFrame per frame, no matter
 * how many layers subscribe. Subscribers receive the latest scrollY + viewport height and
 * mutate the DOM imperatively (never via React state) for 60fps motion.
 */

type Subscriber = (scrollY: number, viewportH: number) => void

const subscribers = new Set<Subscriber>()
let ticking = false
let started = false

function flush() {
  ticking = false
  const scrollY = window.scrollY
  const viewportH = window.innerHeight
  subscribers.forEach((fn) => fn(scrollY, viewportH))
}

function requestTick() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(flush)
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('scroll', requestTick, { passive: true })
  window.addEventListener('resize', requestTick, { passive: true })
}

/**
 * Subscribe to scroll/resize ticks. Returns an unsubscribe function.
 * The subscriber is invoked once immediately so layers initialise at the correct position.
 */
export function subscribeToScroll(fn: Subscriber): () => void {
  ensureStarted()
  subscribers.add(fn)
  if (typeof window !== 'undefined') {
    fn(window.scrollY, window.innerHeight)
  }
  return () => {
    subscribers.delete(fn)
  }
}
