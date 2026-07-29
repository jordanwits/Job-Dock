/**
 * Marketing-site analytics (PostHog).
 *
 * Scope is deliberately narrow: only the pages a prospect sees on the way to becoming a
 * customer. The authed app (/app/*), the tenant-facing public pages (/book, /public/*, /s/:code)
 * and the OAuth callbacks are all out of scope — those are our customers' customers, and
 * capturing them would both pollute the acquisition funnel and put tenant data in a third-party
 * tool.
 *
 * Choosing which pageviews to send is not enough to enforce that. Autocapture and session
 * recording are global listeners installed by init(), so once the SDK is running it keeps
 * capturing across client-side navigation no matter what we do about pageviews. So this module
 * also:
 *   - never loads the SDK at all unless the visitor reaches a marketing route, and
 *   - opts capture out, and stops recording, the moment they navigate out of scope.
 *
 * Everything here is a no-op without VITE_POSTHOG_KEY, which is how local dev and previews stay
 * out of the production data.
 */
import { appEnv } from './env'

type PostHogClient = (typeof import('posthog-js'))['default']

/**
 * Marketing routes with a fixed path.
 *
 * The signup pages are in scope on purpose: measuring where people fall off is the whole point,
 * and the drop happens between the pricing CTA and a completed signup. /auth/login and
 * /auth/reset-password are not — those are returning customers, not prospects.
 */
const STATIC_PATHS = new Set([
  '/',
  '/about',
  '/privacy',
  '/terms',
  '/sms-consent',
  '/email-policy',
  '/compare',
  '/guides',
  '/auth/signup',
  '/auth/signup/complete',
  '/auth/tester',
])

/** Content articles. These match the `/compare/:slug` and `/guides/:slug` routes in App.tsx. */
const PREFIXES = ['/compare/', '/guides/']

/** Vertical landing pages, which sit at the site root and so can't be matched by prefix. */
let contentPaths: ReadonlySet<string> = new Set()

let client: PostHogClient | null = null
let loading: Promise<PostHogClient | null> | null = null
let capturing = false
let currentPath = ''
let currentSignedIn = false

/**
 * Hands the scope check the list of root-level content routes. Must run before the first
 * navigation — App.tsx calls it at module scope, from the same registry the routes are built
 * from, so the two cannot drift.
 */
export function registerContentPaths(paths: readonly string[]): void {
  contentPaths = new Set(paths.map(normalize))
}

/** Trailing slashes are equivalent in the router but not to a Set lookup. */
function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function isMarketingPath(pathname: string): boolean {
  const path = normalize(pathname)
  return (
    STATIC_PATHS.has(path) || contentPaths.has(path) || PREFIXES.some((p) => path.startsWith(p))
  )
}

function load(): Promise<PostHogClient | null> {
  if (!loading) {
    // Dynamically imported so posthog-js gets its own chunk: signed-in users, who never hit a
    // marketing route, never download it. A failed import — ad blocker, offline — resolves to
    // null instead of throwing, because analytics must never take the page down with it.
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(appEnv.posthogKey, {
          // Same-origin proxy; see the /ingest rewrites in vercel.json. Keeps the CSP on
          // script-src/connect-src 'self' and stops ad blockers dropping the requests.
          api_host: '/ingest',
          ui_host: 'https://us.posthog.com',
          // Pageviews come from the router below instead, so out-of-scope routes send none.
          capture_pageview: false,
          // Defaults to 'if_capture_pageview', which the line above would turn off.
          capture_pageleave: true,
          // Nothing is captured until syncAnalytics opts in. This closes the window between
          // init() installing its listeners and the first scope check running.
          opt_out_capturing_by_default: true,
        })
        client = posthog
        return posthog
      })
      .catch(() => null)
  }
  return loading
}

/**
 * Call on every navigation. Loads and enables PostHog inside marketing scope, and shuts it off
 * on the way out.
 *
 * `signedIn` tags events with whether the visitor already has an account, so acquisition
 * reporting can exclude them. They are not prospects: they inflate the top of the funnel, and
 * every signup CTA bounces them to /app (SignupPage redirects when authenticated), which would
 * otherwise read as a drop-off that never happened.
 */
export function syncAnalytics(pathname: string, signedIn: boolean): void {
  currentPath = normalize(pathname)
  currentSignedIn = signedIn
  if (!appEnv.posthogKey) return
  // Never pull the SDK in for someone who has not been on a marketing page.
  if (!client && !isMarketingPath(currentPath)) return
  void load().then(apply)
}

function apply(posthog: PostHogClient | null): void {
  if (!posthog) return

  // window.location is the authority here, not the path syncAnalytics was handed. Two reasons.
  // The import can resolve several navigations later, so the original argument goes stale. And
  // posthog stamps $current_url off window.location when it builds the event, so trusting the
  // router path can mislabel a pageview: a redirect fired from an effect — SignupPage bounces
  // authenticated visitors to /app — moves the browser between the router effect and this
  // microtask, and we would capture "/auth/signup" while the browser is already on /app.
  const livePath = normalize(window.location.pathname)

  if (!isMarketingPath(livePath)) {
    if (capturing) {
      posthog.stopSessionRecording()
      posthog.opt_out_capturing()
      capturing = false
    }
    return
  }

  if (!capturing) {
    // Recording is deliberately not restarted here. Coming back into scope mid-session means
    // they were just inside the app, and resuming would risk catching the tail of it; erring
    // toward less recording is the safe direction. A fresh page load starts it again.
    posthog.opt_in_capturing({ captureEventName: false })
    capturing = true
  }
  // Registered rather than passed to capture() so it also lands on autocaptured clicks — the
  // CTA click is the step that would otherwise strand a signed-in visitor mid-funnel.
  posthog.register({ signed_in: currentSignedIn })

  // A navigation overtook this one and has not reached its own effect yet. Capturing now would
  // file the pageview under whichever URL the browser happens to be showing. Drop it; the
  // navigation that won will fire its own sync.
  if (livePath !== currentPath) return

  posthog.capture('$pageview')
}

/**
 * Manual event, for conversions autocapture can't name reliably. Silently does nothing outside
 * marketing scope.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!client || !capturing) return
  client.capture(event, properties)
}
