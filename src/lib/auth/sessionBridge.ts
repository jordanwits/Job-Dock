export type TokenRefreshPayload = {
  token: string
  refreshToken: string
  user?: unknown
}

type TokenRefreshHandler = (payload: TokenRefreshPayload) => void
type SessionClearHandler = () => void

let onTokenRefreshed: TokenRefreshHandler | null = null
let onSessionCleared: SessionClearHandler | null = null

/**
 * Register a handler to update in-memory auth state (e.g. Zustand store)
 * when a token refresh occurs inside the API client.
 */
export function registerTokenRefreshHandler(handler: TokenRefreshHandler) {
  onTokenRefreshed = handler
}

/**
 * Register a handler to clear in-memory auth state when the API client
 * decides the session is no longer valid.
 */
export function registerSessionClearHandler(handler: SessionClearHandler) {
  onSessionCleared = handler
}

export function notifyTokenRefreshed(payload: TokenRefreshPayload) {
  onTokenRefreshed?.(payload)
}

export function notifySessionCleared() {
  onSessionCleared?.()
}

