/**
 * Platform super-admin allowlist (cross-tenant operations). Separate from tenant role "admin".
 * Set JOBDOCK_PLATFORM_ADMIN_EMAILS=comma,separated,emails
 */
/**
 * The configured platform-admin allowlist, normalized (lowercased, trimmed, de-blanked).
 * Empty when JOBDOCK_PLATFORM_ADMIN_EMAILS is unset — callers must fail closed on that.
 * (Wired into the Lambda env in jobdock-stack.ts.)
 */
export function getPlatformAdminEmails(): string[] {
  const raw = (process.env.JOBDOCK_PLATFORM_ADMIN_EMAILS || '').trim()
  if (!raw) return []
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isPlatformAdmin(email: string | undefined | null): boolean {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return false

  // Fail closed: if no allowlist is configured, nobody is a platform admin.
  return getPlatformAdminEmails().includes(normalized)
}
