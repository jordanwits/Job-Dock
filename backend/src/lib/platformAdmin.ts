/**
 * Platform super-admin allowlist (cross-tenant operations). Separate from tenant role "admin".
 * Set JOBDOCK_PLATFORM_ADMIN_EMAILS=comma,separated,emails
 */
export function isPlatformAdmin(email: string | undefined | null): boolean {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return false

  // Fail closed: if no allowlist is configured, nobody is a platform admin.
  // (Set JOBDOCK_PLATFORM_ADMIN_EMAILS in the Lambda env — wired in jobdock-stack.ts.)
  const raw = (process.env.JOBDOCK_PLATFORM_ADMIN_EMAILS || '').trim()
  if (!raw) return false
  const allow = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

  return allow.includes(normalized)
}
