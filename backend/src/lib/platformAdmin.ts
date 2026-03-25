/**
 * Platform super-admin allowlist (cross-tenant operations). Separate from tenant role "admin".
 * Set JOBDOCK_PLATFORM_ADMIN_EMAILS=comma,separated,emails
 */
export function isPlatformAdmin(email: string | undefined | null): boolean {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return false

  const raw = (process.env.JOBDOCK_PLATFORM_ADMIN_EMAILS || '').trim()
  const allow = raw
    ? raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : ['jordan@westwavecreative.com']

  return allow.includes(normalized)
}
