/**
 * Browser-local preferences for the AI assistant.
 *
 * `confirmWrites` controls whether the assistant stops and asks before each
 * write action (create/edit/send/convert/record payment). It defaults to ON;
 * turning it off lets the assistant act as soon as it decides to, with no
 * confirm step.
 *
 * Deletes are deliberately NOT covered by this preference — they're permanent
 * and there's no undo, so the agent loop confirms them either way (see the
 * `destructive` check in assistantClient.ts).
 */
const CONFIRM_WRITES_KEY = 'jobdock:assistant:confirm-writes'

/** Read the stored preference. Defaults to true (ask) when unset or unreadable. */
export function loadConfirmWrites(): boolean {
  try {
    return localStorage.getItem(CONFIRM_WRITES_KEY) !== 'off'
  } catch {
    // Storage blocked (private mode / hardened settings) — fall back to asking.
    return true
  }
}

/** Persist the preference. Silently no-ops if storage is unavailable. */
export function saveConfirmWrites(on: boolean): void {
  try {
    localStorage.setItem(CONFIRM_WRITES_KEY, on ? 'on' : 'off')
  } catch {
    // Not fatal: the toggle still applies for the rest of this session.
  }
}
