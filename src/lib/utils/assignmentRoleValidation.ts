/**
 * When at least one team member is assigned, requires an explicit role
 * (job role from the list or a non-empty custom title).
 */
export function getTeamAssignmentRoleValidationMessage(
  assignments: Array<{ userId?: string; role?: string; roleId?: string }>,
  jobRoles: ReadonlyArray<{ id: string }>
): string | null {
  const withMember = assignments.filter(a => (a.userId ?? '').trim() !== '')
  if (withMember.length === 0) return null

  const chooseOrEnter =
    'Each assigned team member must have a role. Select a job role or enter a custom role.'
  const customEmpty = 'Enter a custom role name for each assigned team member.'

  for (const a of withMember) {
    const roleTitle = (a.role ?? '').trim()
    if (jobRoles.length > 0) {
      const rid = a.roleId
      if (rid && rid !== 'custom') continue
      if (rid === 'custom' && !roleTitle) return customEmpty
      if (!rid && !roleTitle) return chooseOrEnter
    } else if (!roleTitle) {
      return chooseOrEnter
    }
  }
  return null
}
