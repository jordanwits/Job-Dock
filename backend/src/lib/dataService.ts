import {
  Prisma,
  Quote,
  Invoice,
  QuoteLineItem,
  InvoiceLineItem,
  Contact,
  Job,
  JobRecurrence,
  SavedLineItem,
} from '@prisma/client'
import prisma from './db'
import { ensureTenantExists } from './tenant'
import { ApiError } from './errors'
import {
  sendEmail,
  buildClientConfirmationEmail,
  buildClientPendingEmail,
  buildClientRescheduleEmail,
  buildContractorNotificationEmail,
  buildClientBookingConfirmedEmail,
  buildClientBookingDeclinedEmail,
  buildJobAssignmentNotificationEmail,
  buildSignupCompleteEmail,
  sendQuoteEmail,
  sendInvoiceEmail,
  sendQuoteAcceptedNotificationToUsers,
  sendInvoiceAcceptedNotificationToUsers,
  sendQuoteDeclinedNotificationToAdmins,
  sendInvoiceDeclinedNotificationToAdmins,
} from './email'
import { helpService } from './helpChat'
import { assistantChatService } from './assistantChat'
import {
  sendSms,
  buildBookingConfirmationSms,
  buildBookingPendingSms,
  buildRescheduleNotificationSms,
  buildBookingDeclinedSms,
  buildQuoteNotificationSms,
  buildInvoiceNotificationSms,
  shouldSendEmail,
  shouldSendSms,
} from './sms'
import { generateApprovalToken } from './approvalTokens'
import { uploadFile, deleteFile, getFileUrl } from './fileUpload'
import { createPhotoToken } from './photoToken'
import {
  createImportSession,
  getImportSession,
  processImportSession,
  resolveConflict,
  getImportSessionData,
  parseCSVPreview,
} from './csvImport'
import {
  parseSavedLineItemCSVPreview,
  createSavedLineItemImportSession,
  getSavedLineItemImportSession,
  processSavedLineItemImportSession,
  getSavedLineItemImportSessionData,
  resolveSavedLineItemConflict,
} from './savedLineItemCsvImport'
import { normalizeSavedLineItemName } from './savedLineItemCsvHelpers'
import { addDays, addWeeks, addMonths } from 'date-fns'
import { toZonedTime, fromZonedTime, getTimezoneOffset } from 'date-fns-tz'

// Legacy hardcoded offset (America/Los_Angeles) used before per-tenant timezones existed. Kept as
// the fallback for tenants that haven't set TenantSettings.timezone yet, so their behavior doesn't
// change until they configure it.
const LEGACY_DEFAULT_OFFSET_HOURS = -8

/**
 * A tenant's UTC offset in HOURS at a specific instant, derived DST-correctly from its IANA
 * timezone (e.g. 'America/New_York'). Used to render local times for booking slots and
 * email/SMS. The offset is instant-specific because of DST, so pass the appointment/slot time.
 * Falls back to the legacy -8 when the tenant has no timezone set (or an invalid one).
 */
function offsetHoursForZone(timezone: string | null | undefined, at: Date): number {
  if (!timezone) return LEGACY_DEFAULT_OFFSET_HOURS
  try {
    const ms = getTimezoneOffset(timezone, at)
    return Number.isNaN(ms) ? LEGACY_DEFAULT_OFFSET_HOURS : ms / 3_600_000
  } catch {
    return LEGACY_DEFAULT_OFFSET_HOURS
  }
}

// Recurrence types
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  untilDate?: string
  daysOfWeek?: number[]
  timezone?: string // IANA timezone e.g. 'America/New_York' - preserves local time across DST
}

const toNumber = (value: Prisma.Decimal | number | null | undefined) => (value ? Number(value) : 0)

function serializeSavedLineItem(item: SavedLineItem) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    name: item.name,
    normalizedName: item.normalizedName,
    description: item.description,
    defaultQuantity: toNumber(item.defaultQuantity) || 1,
    unitPrice: toNumber(item.unitPrice),
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function serializeSavedLineItemImportResponse(
  data: ReturnType<typeof getSavedLineItemImportSessionData>
) {
  return {
    ...data,
    pendingConflicts: data.pendingConflicts.map(c => ({
      ...c,
      existingItem: serializeSavedLineItem(c.existingItem),
    })),
  }
}

// Helper to parse and validate a date, returns null if invalid
function parseValidDate(value: any): Date | null {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

// JobAssignment type for structured assignments
interface JobAssignment {
  userId: string
  roleId?: string
  role: string
  price?: number | null
  payType?: 'job' | 'hourly'
  hourlyRate?: number | null
}

// Normalize assignedTo to new format: array of assignment objects
// Accepts both old format (array of IDs) and new format (array of objects)
function normalizeAssignedTo(assignedTo: any): JobAssignment[] | null {
  if (!assignedTo) return null

  // Handle new format: array of objects
  if (Array.isArray(assignedTo) && assignedTo.length > 0) {
    // Check if it's already in new format (array of objects with userId)
    if (typeof assignedTo[0] === 'object' && assignedTo[0] !== null && 'userId' in assignedTo[0]) {
      const normalized = assignedTo
        .filter(
          (item: any) =>
            item && typeof item === 'object' && item.userId && typeof item.userId === 'string'
        )
        .map((item: any) => ({
          userId: item.userId.trim(),
          roleId: typeof item.roleId === 'string' ? item.roleId.trim() : undefined,
          role: typeof item.role === 'string' ? item.role.trim() : 'Team Member',
          price:
            typeof item.price === 'number'
              ? item.price
              : item.price === null || item.price === undefined
                ? null
                : undefined,
          payType:
            typeof item.payType === 'string' &&
            (item.payType === 'job' || item.payType === 'hourly')
              ? item.payType
              : 'job',
          hourlyRate:
            typeof item.hourlyRate === 'number'
              ? item.hourlyRate
              : item.hourlyRate === null || item.hourlyRate === undefined
                ? null
                : undefined,
        }))
      return normalized.length > 0 ? normalized : null
    }

    // Handle old format: array of user ID strings
    const filtered = assignedTo.filter(
      (id: any) => id && typeof id === 'string' && id.trim() !== ''
    )
    if (filtered.length > 0) {
      return filtered.map((id: string) => ({
        userId: id.trim(),
        role: 'Team Member',
        price: null,
        payType: 'job' as const,
        hourlyRate: null,
      }))
    }
  }

  // Handle old format: single string ID
  if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
    return [
      {
        userId: assignedTo.trim(),
        role: 'Team Member',
        price: null,
        payType: 'job' as const,
        hourlyRate: null,
      },
    ]
  }

  return null
}

// Extract user IDs from assignedTo (handles both old and new formats)
function extractUserIds(assignedTo: any): string[] {
  if (!assignedTo) return []

  // New format: array of objects with userId
  if (Array.isArray(assignedTo) && assignedTo.length > 0) {
    if (typeof assignedTo[0] === 'object' && assignedTo[0] !== null && 'userId' in assignedTo[0]) {
      return assignedTo
        .filter((item: any) => item && typeof item === 'object' && item.userId)
        .map((item: any) => item.userId)
        .filter((id: any) => id && typeof id === 'string')
    }
    // Old format: array of strings
    return assignedTo.filter((id: any) => id && typeof id === 'string')
  }

  // Old format: single string
  if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
    return [assignedTo.trim()]
  }

  return []
}

// Fetch assigned users and create assignedToName string
async function getAssignedToName(tenantId: string, assignedTo: any): Promise<string | undefined> {
  if (!assignedTo) return undefined

  const userIds = extractUserIds(assignedTo)

  if (userIds.length === 0) return undefined

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { name: true },
  })

  const names = users.map(u => u.name).filter(Boolean)
  return names.length > 0 ? names.join(', ') : undefined
}

// Fetch assigned users with id and name (for clock-in selector when employee can't list all users)
async function getAssignedToUsers(
  tenantId: string,
  assignedTo: any
): Promise<Array<{ id: string; name: string }>> {
  if (!assignedTo) return []

  const userIds = extractUserIds(assignedTo)

  if (userIds.length === 0) return []

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true, name: true },
  })

  return users.map(u => ({ id: u.id, name: u.name || u.id }))
}

// Validate assignedTo structure and that all user IDs belong to tenant (throws if invalid)
async function validateAssignedTo(tenantId: string, assignedTo: any): Promise<void> {
  if (!assignedTo) return

  const normalized = normalizeAssignedTo(assignedTo)
  if (!normalized || normalized.length === 0) return

  // Extract user IDs - ensure they're strings
  const userIds = normalized
    .map(a => {
      if (typeof a === 'object' && a !== null && 'userId' in a) {
        return typeof a.userId === 'string' ? a.userId : null
      }
      // Fallback: if it's already a string (old format)
      return typeof a === 'string' ? a : null
    })
    .filter((id): id is string => id !== null && typeof id === 'string' && id.trim() !== '')

  if (userIds.length === 0) return

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      tenantId,
    },
    select: { id: true },
  })

  const foundIds = new Set(users.map(u => u.id))
  const invalidIds = userIds.filter(id => !foundIds.has(id))

  if (invalidIds.length > 0) {
    throw new ApiError(
      `Assigned user(s) must be members of your team. Invalid IDs: ${invalidIds.join(', ')}`,
      400
    )
  }

  // Validate roles are strings and roleId exists if provided
  const roleIds = normalized
    .map(a => {
      if (typeof a === 'object' && a !== null && 'roleId' in a && typeof a.roleId === 'string') {
        return a.roleId.trim()
      }
      return null
    })
    .filter((id): id is string => id !== null && id !== '')

  if (roleIds.length > 0) {
    const jobRoles = await prisma.jobRole.findMany({
      where: {
        id: { in: roleIds },
        tenantId,
      },
      select: { id: true },
    })

    const foundRoleIds = new Set(jobRoles.map(r => r.id))
    const invalidRoleIds = roleIds.filter(id => !foundRoleIds.has(id))

    if (invalidRoleIds.length > 0) {
      throw new ApiError(`Invalid job role ID(s): ${invalidRoleIds.join(', ')}`, 400)
    }
  }

  for (const assignment of normalized) {
    if (typeof assignment === 'object' && assignment !== null) {
      if (typeof assignment.role !== 'string' || assignment.role.trim() === '') {
        throw new ApiError('All assignments must have a valid role (non-empty string)', 400)
      }

      // Validate prices are numbers if provided
      if (
        assignment.price !== null &&
        assignment.price !== undefined &&
        typeof assignment.price !== 'number'
      ) {
        throw new ApiError('Price must be a number if provided', 400)
      }
    }
  }
}

// Apply effective-date logic when pay (hourly rate) changes on a job with time entries.
// effectiveDate: ISO date string (YYYY-MM-DD) or Date. When today/future: preserve old rate on existing entries.
// When past: entries on/after that date get new rate; entries before get old rate.
async function applyPayChangeEffectiveDate(
  tenantId: string,
  jobId: string,
  oldAssignedTo: any,
  newAssignedTo: JobAssignment[] | null,
  effectiveDateRaw: string | Date
): Promise<void> {
  if (!newAssignedTo || newAssignedTo.length === 0) return
  const oldNorm = normalizeAssignedTo(oldAssignedTo) ?? []
  const oldByUser = new Map<string, JobAssignment>()
  for (const a of oldNorm) {
    if (a && typeof a === 'object' && 'userId' in a && a.userId) oldByUser.set(a.userId, a)
  }
  const effectiveDate =
    typeof effectiveDateRaw === 'string'
      ? new Date(effectiveDateRaw + 'T12:00:00Z') // noon UTC to avoid timezone edge cases
      : new Date(effectiveDateRaw)
  const effectiveDateStart = new Date(
    Date.UTC(
      effectiveDate.getUTCFullYear(),
      effectiveDate.getUTCMonth(),
      effectiveDate.getUTCDate()
    )
  )
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const isEffectiveTodayOrFuture = effectiveDateStart >= todayStart

  const timeEntries = await prisma.timeEntry.findMany({
    where: { jobId, tenantId },
    select: { id: true, userId: true, startTime: true, hourlyRate: true },
  })

  for (const newA of newAssignedTo) {
    const userId = newA?.userId
    if (!userId || typeof userId !== 'string') continue
    const oldA = oldByUser.get(userId)
    const oldRate =
      oldA?.payType === 'hourly' && typeof oldA.hourlyRate === 'number' ? oldA.hourlyRate : null
    const newRate =
      newA?.payType === 'hourly' && typeof newA.hourlyRate === 'number' ? newA.hourlyRate : null
    const rateChanged = oldRate !== newRate
    if (!rateChanged) continue

    const userEntries = timeEntries.filter(e => e.userId === userId)
    if (userEntries.length === 0) continue

    if (isEffectiveTodayOrFuture) {
      await prisma.timeEntry.updateMany({
        where: { id: { in: userEntries.map(e => e.id) } },
        data: { hourlyRate: oldRate != null ? new Prisma.Decimal(oldRate) : null },
      })
    } else {
      for (const e of userEntries) {
        const entryDate = new Date(e.startTime)
        const entryDateStart = new Date(
          Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth(), entryDate.getUTCDate())
        )
        const rate = entryDateStart >= effectiveDateStart ? newRate : oldRate
        await prisma.timeEntry.update({
          where: { id: e.id },
          data: { hourlyRate: rate != null ? new Prisma.Decimal(rate) : null },
        })
      }
    }
  }
}

// Apply privacy filtering to assignedTo based on current user role
function getAssignedToWithPrivacy(
  assignedTo: any,
  currentUserId: string | undefined,
  currentUserRole: string | undefined
): JobAssignment[] | null {
  const normalized = normalizeAssignedTo(assignedTo)
  if (!normalized || normalized.length === 0) return null

  // Admins and owners can see all pricing
  if (currentUserRole === 'admin' || currentUserRole === 'owner') {
    return normalized
  }

  // Employees can only see their own price
  if (currentUserRole === 'employee' && currentUserId) {
    return normalized.map(assignment => {
      if (assignment.userId === currentUserId) {
        // Show their own assignment with price and roleId (needed for clock-in permission check)
        return assignment
      } else {
        // Hide price for other assignments, but keep roleId for permission checks
        return {
          userId: assignment.userId,
          roleId: assignment.roleId,
          role: assignment.role,
          price: undefined, // Explicitly hide price
        }
      }
    })
  }

  // Not assigned or unknown role: hide all prices, but keep roleId for permission checks
  return normalized.map(assignment => ({
    userId: assignment.userId,
    roleId: assignment.roleId,
    role: assignment.role,
    price: undefined, // Hide price
  }))
}

// Decide whether a viewer may see a time entry's hourlyRate (pay).
// Mirrors getAssignedToWithPrivacy's model: admins/owners see every rate; an employee
// sees only the rate on their OWN entries, never a teammate's pay.
function canViewTimeEntryRate(
  currentUserRole: string | undefined,
  currentUserId: string | undefined,
  entryUserId: string | null | undefined
): boolean {
  if (currentUserRole === 'admin' || currentUserRole === 'owner') return true
  return !!currentUserId && !!entryUserId && currentUserId === entryUserId
}

// Map a time entry's hourlyRate to a number only when the viewer is allowed to see it,
// otherwise undefined (field omitted from the response).
function visibleHourlyRate(
  te: { hourlyRate?: any; userId?: string | null },
  currentUserRole: string | undefined,
  currentUserId: string | undefined
): number | undefined {
  if (!canViewTimeEntryRate(currentUserRole, currentUserId, te.userId)) return undefined
  return te.hourlyRate != null ? Number(te.hourlyRate) : undefined
}

// Send assignment notification email (call after successful create/update).
// Callers must AWAIT this (with .catch so a mail failure never fails the API
// call) — a fire-and-forget promise gets frozen when the Lambda returns and
// the email intermittently never sends.
async function sendAssignmentNotification(params: {
  tenantId: string
  assignedTo: any
  assignerUserId: string | undefined
  jobTitle: string
  startTime: Date | null
  endTime: Date | null
  location: string | null | undefined
  contactName?: string
  viewPath?: string // e.g. '/app/scheduling' for jobs, '/app/job-logs' for job logs
  userIdsToNotify?: string[] // Optional: only notify these specific user IDs (for newly added members)
}): Promise<void> {
  const {
    tenantId,
    assignedTo,
    assignerUserId,
    jobTitle,
    startTime,
    endTime,
    location,
    contactName,
    viewPath,
    userIdsToNotify,
  } = params

  const allUserIds = extractUserIds(assignedTo)

  // If userIdsToNotify is provided, only notify those users (for newly added members)
  // Otherwise, notify all assigned users (for new job creation)
  const userIds = userIdsToNotify && userIdsToNotify.length > 0 ? userIdsToNotify : allUserIds

  if (userIds.length === 0) return

  // Get assignees to notify
  const assignees = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      tenantId,
    },
    select: { id: true, name: true, email: true },
  })

  if (assignees.length === 0) return

  const assigner = assignerUserId
    ? await prisma.user.findFirst({
        where: { id: assignerUserId, tenantId },
        select: { name: true },
      })
    : null

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  })
  const fromName = settings?.companyDisplayName || 'JobDock'
  const replyTo = settings?.companySupportEmail || undefined

  // Fetch logo URL if available (7 days expiration for email)
  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      const { getFileUrl } = await import('./fileUpload')
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
    } catch (error) {
      console.error('Error fetching logo URL for email:', error)
    }
  }

  // Send notification to each assignee (excluding the assigner)
  for (const assignee of assignees) {
    if (assignee.id === assignerUserId) continue

    const payload = buildJobAssignmentNotificationEmail({
      assigneeName: assignee.name || 'there',
      assigneeEmail: assignee.email,
      assignerName: assigner?.name || 'Your team',
      jobTitle,
      startTime,
      endTime,
      location: location || undefined,
      contactName,
      viewPath,
      fromName,
      replyTo,
      companyName: fromName,
      logoUrl,
      settings: {
        companySupportEmail: settings?.companySupportEmail || null,
        companyPhone: settings?.companyPhone || null,
      },
    })
    await sendEmail(payload)
  }
}

// Helper to generate recurrence instances
function generateRecurrenceInstances(params: {
  startTime: Date
  endTime: Date
  recurrence: RecurrencePayload
}): Array<{ startTime: Date; endTime: Date }> {
  const { startTime, endTime, recurrence } = params
  const instances: Array<{ startTime: Date; endTime: Date }> = []

  const duration = endTime.getTime() - startTime.getTime()

  // Hard limits for safety
  const MAX_OCCURRENCES = 50
  const MAX_MONTHS = 12

  const maxCount = recurrence.count ? Math.min(recurrence.count, MAX_OCCURRENCES) : MAX_OCCURRENCES

  const maxDate = recurrence.untilDate
    ? new Date(recurrence.untilDate)
    : new Date(startTime.getTime() + MAX_MONTHS * 30 * 24 * 60 * 60 * 1000)

  // #region agent log
  console.log(
    '[DEBUG] generateRecurrenceInstances entry:',
    JSON.stringify({
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString(),
      recurrence,
      maxCount,
      durationMs: duration,
    })
  )
  // #endregion

  // Custom pattern (specific days of week) - works for both 'custom' and 'weekly' with daysOfWeek
  if (
    (recurrence.frequency === 'custom' || recurrence.frequency === 'weekly') &&
    recurrence.daysOfWeek &&
    recurrence.daysOfWeek.length > 0
  ) {
    // #region agent log
    console.log(
      '[DEBUG] Using custom pattern with specific days:',
      JSON.stringify({
        frequency: recurrence.frequency,
        daysOfWeek: recurrence.daysOfWeek,
        maxCount,
      })
    )
    // #endregion
    let instanceCount = 0

    // Generate instances for up to MAX_MONTHS
    const endSearchDate = new Date(
      Math.min(maxDate.getTime(), startTime.getTime() + MAX_MONTHS * 30 * 24 * 60 * 60 * 1000)
    )

    const customTz = recurrence.timezone || undefined
    if (customTz) {
      // Walk days in the BUSINESS timezone so (a) the day-of-week test uses the user's local
      // weekday, not the server's (a Mon 9pm PT start is already Tue in UTC), and (b) the
      // wall-clock time survives DST transitions instead of drifting an hour.
      let zonedCurrent = toZonedTime(startTime, customTz)
      while (instanceCount < maxCount) {
        const instanceStart = fromZonedTime(zonedCurrent, customTz)
        if (instanceStart > endSearchDate) break
        if (recurrence.daysOfWeek.includes(zonedCurrent.getDay())) {
          instances.push({
            startTime: instanceStart,
            endTime: new Date(instanceStart.getTime() + duration),
          })
          instanceCount++
        }
        zonedCurrent = addDays(zonedCurrent, 1)
      }
    } else {
      // Legacy fallback (no timezone provided): native date arithmetic, server-local weekdays.
      let currentDate = new Date(startTime)
      while (instanceCount < maxCount && currentDate <= endSearchDate) {
        const dayOfWeek = currentDate.getDay()

        if (recurrence.daysOfWeek.includes(dayOfWeek)) {
          instances.push({
            startTime: new Date(currentDate),
            endTime: new Date(currentDate.getTime() + duration),
          })
          instanceCount++
        }

        // Move to next day
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }
    // #region agent log
    console.log(
      '[DEBUG] Custom pattern instances generated:',
      JSON.stringify({
        instanceCount,
        firstDateISO: instances[0]?.startTime.toISOString(),
        lastDateISO: instances[instances.length - 1]?.startTime.toISOString(),
      })
    )
    // #endregion

    return instances
  }

  // Standard patterns - FIXED 2026-01-12T22:20:00
  // Normalize frequency to lowercase string for comparison safety
  const freq = String(recurrence.frequency).toLowerCase().trim()
  const interval = recurrence.interval || 1
  // DEBUG: Log frequency detection
  console.log('RECURRENCE_DEBUG_V3:', {
    freq,
    interval,
    originalFreq: recurrence.frequency,
    maxCount,
  })

  // #region agent log
  console.log(
    '[DEBUG] Using standard pattern:',
    JSON.stringify({ freq, originalFrequency: recurrence.frequency, interval, maxCount })
  )
  // #endregion

  const tz = recurrence.timezone || undefined

  let currentStart = new Date(startTime)
  let currentEnd = new Date(endTime)

  for (let i = 0; i < maxCount; i++) {
    if (currentStart > maxDate) break

    instances.push({
      startTime: new Date(currentStart),
      endTime: new Date(currentEnd),
    })

    // Calculate next occurrence. When timezone is provided, use toZonedTime/add/fromZonedTime
    // to preserve local clock time across DST (e.g. "9am" stays 9am when crossing spring DST).
    // Without timezone, use native date arithmetic (works when server TZ matches user).
    if (tz) {
      const zonedStart = toZonedTime(currentStart, tz)
      let nextZoned: Date
      if (freq === 'daily') {
        nextZoned = addDays(zonedStart, interval)
      } else if (freq === 'weekly') {
        nextZoned = addWeeks(zonedStart, interval)
      } else if (freq === 'monthly') {
        // Anchor monthly occurrences to the ORIGINAL start's day-of-month, not the previous
        // occurrence: addMonths on the previous result compounds date-fns' end-of-month clamp
        // (Jan 31 → Feb 28 → Mar 28 …), permanently collapsing a 31st/last-day series to the 28th
        // after February. From the original it re-expands each month (Jan 31, Feb 28, Mar 31 …).
        nextZoned = addMonths(toZonedTime(new Date(startTime), tz), (i + 1) * interval)
      } else {
        nextZoned = addDays(zonedStart, interval)
      }
      currentStart = fromZonedTime(nextZoned, tz)
    } else {
      if (freq === 'daily') {
        currentStart = new Date(currentStart)
        currentStart.setDate(currentStart.getDate() + interval)
      } else if (freq === 'weekly') {
        currentStart = new Date(currentStart)
        currentStart.setDate(currentStart.getDate() + interval * 7)
      } else if (freq === 'monthly') {
        // Anchor to the ORIGINAL start (see the tz branch): setMonth on the previous occurrence
        // overflows (Jan 31 + 1mo → "Feb 31" → Mar 2/3, skipping February). addMonths from the
        // original clamps to each target month's length instead.
        currentStart = addMonths(new Date(startTime), (i + 1) * interval)
      } else {
        currentStart = new Date(currentStart)
        currentStart.setDate(currentStart.getDate() + interval)
      }
    }

    currentEnd = new Date(currentStart.getTime() + duration)
  }

  // #region agent log
  console.log(
    '[DEBUG] Standard pattern instances generated:',
    JSON.stringify({
      totalInstances: instances.length,
      firstDateISO: instances[0]?.startTime.toISOString(),
      secondDateISO: instances[1]?.startTime.toISOString(),
      lastDateISO: instances[instances.length - 1]?.startTime.toISOString(),
    })
  )
  // #endregion

  return instances
}

// Helper to create recurring jobs
async function createRecurringJobs(params: {
  tenantId: string
  title: string
  description?: string
  contactId: string
  serviceId?: string
  quoteId?: string
  invoiceId?: string
  startTime: Date
  endTime: Date
  status?: string
  location?: string
  price?: number
  notes?: string
  assignedTo?: string | string[] | JobAssignment[] | null
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
  recurrence: RecurrencePayload
  forceBooking?: boolean
  excludeJobId?: string // Job ID to exclude from conflict checking (for converting existing job to recurring)
  existingJobId?: string // Reuse this Job row instead of creating one (converting an existing job to recurring)
  createdById?: string
}) {
  const {
    tenantId,
    title,
    description,
    contactId,
    serviceId,
    quoteId,
    invoiceId,
    startTime,
    endTime,
    status = 'active',
    location,
    price,
    notes,
    assignedTo: assignedToParam,
    breaks,
    recurrence,
    forceBooking = false,
    excludeJobId,
    existingJobId,
    createdById,
  } = params

  // JobRecurrence.assignedTo is String? - convert array to first element for now (schema not yet migrated)
  const assignedToForRecurrence =
    assignedToParam == null
      ? null
      : Array.isArray(assignedToParam)
        ? assignedToParam[0] && typeof assignedToParam[0] === 'string'
          ? assignedToParam[0]
          : null
        : typeof assignedToParam === 'string' && assignedToParam.trim() !== ''
          ? assignedToParam
          : null

  // Jobs use Json (array) - normalize to array
  const assignedToForJobs = normalizeAssignedTo(assignedToParam)

  return await prisma.$transaction(async tx => {
    // 1. Create the JobRecurrence record
    const jobRecurrence = await tx.jobRecurrence.create({
      data: {
        tenantId,
        contactId,
        serviceId,
        title,
        description,
        location,
        notes,
        assignedTo: assignedToForRecurrence,
        status: 'active',
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        count: recurrence.count,
        untilDate: recurrence.untilDate ? new Date(recurrence.untilDate) : null,
        daysOfWeek: recurrence.daysOfWeek || [],
        startTime,
        endTime,
      },
    })

    // 2. Generate all occurrence instances
    let instances = generateRecurrenceInstances({
      startTime,
      endTime,
      recurrence,
    })

    // #region agent log
    console.log(
      '[DEBUG] Generated instances:',
      JSON.stringify({
        count: instances.length,
        first3: instances
          .slice(0, 3)
          .map(i => ({ start: i.startTime.toISOString(), end: i.endTime.toISOString() })),
        allStartTimes: instances.map(i => i.startTime.toISOString()),
      })
    )
    // #endregion

    // 2.5. Filter out instances that fall within break periods
    if (breaks && breaks.length > 0) {
      instances = instances.filter(instance => {
        // Check if this instance overlaps with any break period
        const instanceStart = instance.startTime
        const instanceEnd = instance.endTime

        for (const breakPeriod of breaks) {
          const breakStart = new Date(breakPeriod.startTime)
          const breakEnd = new Date(breakPeriod.endTime)

          // Check if instance overlaps with break period
          if (instanceStart < breakEnd && instanceEnd > breakStart) {
            console.log(
              `Skipping instance ${instanceStart.toISOString()} due to break period ${breakStart.toISOString()} - ${breakEnd.toISOString()}`
            )
            return false // Skip this instance
          }
        }

        return true // Keep this instance
      })
    }

    // Double booking check removed - allowing overlapping recurring jobs

    // 4. Create (or reuse) one Job and multiple Bookings (one per instance)
    let job
    if (existingJobId) {
      // Converting an existing job to recurring: replace its bookings but keep
      // the Job row itself so time entries, photos, and job-log history survive.
      await tx.booking.deleteMany({ where: { jobId: existingJobId, tenantId } })
      job = await tx.job.update({
        where: { id: existingJobId },
        data: {
          title,
          description,
          contactId,
          serviceId: serviceId ?? null,
          quoteId,
          invoiceId,
          status: 'active',
          location,
          ...(price !== undefined ? { price } : {}),
          notes,
          assignedTo: (assignedToForJobs ?? undefined) as unknown as Prisma.InputJsonValue,
        },
        include: {
          contact: true,
        },
      })
    } else {
      job = await tx.job.create({
        data: {
          tenantId,
          title,
          description,
          contactId,
          serviceId: serviceId ?? null,
          quoteId,
          invoiceId,
          status: 'active',
          location,
          price: price !== undefined ? price : null,
          notes,
          assignedTo: (assignedToForJobs ?? undefined) as unknown as Prisma.InputJsonValue,
          createdById: createdById ?? undefined,
        },
        include: {
          contact: true,
        },
      })
    }

    const bookings = await Promise.all(
      instances.map(instance =>
        tx.booking.create({
          data: {
            tenantId,
            jobId: job.id,
            serviceId,
            quoteId,
            invoiceId,
            recurrenceId: jobRecurrence.id,
            startTime: instance.startTime,
            endTime: instance.endTime,
            toBeScheduled: false,
            status,
            location,
            price: price !== undefined ? price : null,
            notes,
            assignedTo: (assignedToForJobs ?? undefined) as unknown as Prisma.InputJsonValue,
            createdById: createdById ?? undefined,
          },
          include: {
            service: true,
          },
        })
      )
    )

    // Return the first booking with job and recurrence metadata (for backward compat)
    const firstBooking = bookings[0]
    const merged = { ...job, ...firstBooking, service: (firstBooking as any).service }
    const assignedToName = await getAssignedToName(tenantId, merged.assignedTo)
    return {
      ...merged,
      // Restore job identity after the booking spread (booking title/contactId
      // are null for job-backed bookings and would clobber the job's).
      id: job.id,
      title: job.title,
      contactId: job.contactId,
      bookingId: firstBooking.id,
      assignedToName,
      recurrenceId: jobRecurrence.id,
      occurrenceCount: bookings.length,
    }
  })
}

const withContactInfo = (
  contact?: Pick<
    Contact,
    'firstName' | 'lastName' | 'email' | 'company' | 'phone' | 'notificationPreference'
  > | null
) => ({
  contactName: contact
    ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || undefined
    : undefined,
  contactEmail: contact?.email ?? undefined,
  contactCompany: contact?.company ?? undefined,
  contactPhone: contact?.phone ?? undefined,
  contactNotificationPreference: (contact as any)?.notificationPreference ?? 'both',
})

async function generateSequentialNumber(tenantId: string, model: 'quote' | 'invoice') {
  const prefix = model === 'quote' ? 'QT' : 'INV'
  const yearPrefix = `${prefix}-${new Date().getFullYear()}-`
  // Next number = highest existing suffix for this tenant+year + 1 — NOT
  // count+1, which reissues a live number after any delete (duplicate
  // documents sent to customers; QuickBooks then rejects the duplicate
  // DocNumber on sync). Numbers restart at 001 each calendar year; the year
  // in the prefix keeps them unique across years.
  const numbers: string[] =
    model === 'quote'
      ? (
          await prisma.quote.findMany({
            where: { tenantId, quoteNumber: { startsWith: yearPrefix } },
            select: { quoteNumber: true },
          })
        ).map(r => r.quoteNumber)
      : (
          await prisma.invoice.findMany({
            where: { tenantId, invoiceNumber: { startsWith: yearPrefix } },
            select: { invoiceNumber: true },
          })
        ).map(r => r.invoiceNumber)
  const maxSuffix = numbers.reduce((max, value) => {
    const suffix = parseInt(value.slice(yearPrefix.length), 10)
    return Number.isFinite(suffix) && suffix > max ? suffix : max
  }, 0)
  return `${yearPrefix}${String(maxSuffix + 1).padStart(3, '0')}`
}

const CLIENT_DECLINE_REASON_MAX_LEN = 2000

function normalizeClientDeclineReason(input: unknown): string | null {
  if (input === undefined || input === null) return null
  if (typeof input !== 'string') return null
  const t = input.trim()
  if (!t) return null
  return t.slice(0, CLIENT_DECLINE_REASON_MAX_LEN)
}

const serializeQuote = (
  quote: Quote & {
    contact?: Contact
    lineItems: QuoteLineItem[]
  }
) => ({
  id: quote.id,
  quoteNumber: quote.quoteNumber,
  title: quote.title ?? undefined,
  contactId: quote.contactId,
  lineItems: quote.lineItems.map((item: QuoteLineItem) => ({
    id: item.id,
    description: item.description,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    total: toNumber(item.total),
  })),
  subtotal: toNumber(quote.subtotal),
  taxRate: toNumber(quote.taxRate),
  taxAmount: toNumber(quote.taxAmount),
  discount: toNumber(quote.discount),
  discountReason: quote.discountReason ?? undefined,
  total: toNumber(quote.total),
  status: quote.status as any,
  clientDeclineReason: quote.clientDeclineReason ?? undefined,
  notes: quote.notes ?? undefined,
  validUntil: quote.validUntil?.toISOString(),
  createdAt: quote.createdAt.toISOString(),
  updatedAt: quote.updatedAt.toISOString(),
  ...withContactInfo(quote.contact),
})

const serializeInvoice = (
  invoice: Invoice & {
    contact?: Contact
    lineItems: InvoiceLineItem[]
  }
) => ({
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  title: invoice.title ?? undefined,
  contactId: invoice.contactId,
  lineItems: invoice.lineItems.map((item: InvoiceLineItem) => ({
    id: item.id,
    description: item.description,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    total: toNumber(item.total),
  })),
  subtotal: toNumber(invoice.subtotal),
  taxRate: toNumber(invoice.taxRate),
  taxAmount: toNumber(invoice.taxAmount),
  discount: toNumber(invoice.discount),
  discountReason: invoice.discountReason ?? undefined,
  total: toNumber(invoice.total),
  status: invoice.status,
  paymentStatus: invoice.paymentStatus,
  approvalStatus: (invoice as any).approvalStatus ?? 'none',
  approvalAt: (invoice as any).approvalAt?.toISOString(),
  clientDeclineReason: invoice.clientDeclineReason ?? undefined,
  notes: invoice.notes ?? undefined,
  dueDate: invoice.dueDate?.toISOString(),
  paymentTerms: invoice.paymentTerms,
  paidAmount: toNumber(invoice.paidAmount),
  trackResponse: (invoice as any).trackResponse ?? true,
  trackPayment: (invoice as any).trackPayment ?? true,
  quickbooksInvoiceId: (invoice as any).quickbooksInvoiceId ?? undefined,
  quickbooksSyncStatus: (invoice as any).quickbooksSyncStatus ?? undefined,
  quickbooksInvoiceUrl: (invoice as any).quickbooksInvoiceUrl ?? undefined,
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString(),
  convertedFromQuoteNumber: (invoice as any).convertedFromQuoteNumber ?? undefined,
  convertedFromQuoteTotal:
    (invoice as any).convertedFromQuoteTotal != null
      ? toNumber((invoice as any).convertedFromQuoteTotal)
      : undefined,
  convertedFromQuoteCreatedAt: (invoice as any).convertedFromQuoteCreatedAt?.toISOString(),
  ...withContactInfo(invoice.contact),
})

export const dataServices = {
  settings: {
    get: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      // If settings don't exist, create default settings
      if (!settings) {
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            companyDisplayName: tenant?.name || 'Your Company',
          },
        })
      }

      // Generate signed URLs for logo and PDF templates if they exist
      const result: any = {
        ...settings,
        tenantName: tenant?.name,
      }

      if (settings.logoUrl) {
        try {
          result.logoSignedUrl = await getFileUrl(settings.logoUrl, 3600)
        } catch (error) {
          console.error('Error generating logo signed URL:', error)
        }
      }

      if (settings.invoicePdfTemplateKey) {
        try {
          result.invoicePdfSignedUrl = await getFileUrl(settings.invoicePdfTemplateKey, 3600)
        } catch (error) {
          console.error('Error generating invoice PDF signed URL:', error)
        }
      }

      if (settings.quotePdfTemplateKey) {
        try {
          result.quotePdfSignedUrl = await getFileUrl(settings.quotePdfTemplateKey, 3600)
        } catch (error) {
          console.error('Error generating quote PDF signed URL:', error)
        }
      }

      return result
    },
    // Public method for getting tenant settings (for public booking pages)
    getPublic: async (tenantId: string) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      // If settings don't exist, create default settings
      if (!settings) {
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            companyDisplayName: tenant?.name || 'Your Company',
          },
        })
      }

      // Generate signed URL for logo if it exists
      // Only return companyDisplayName if it's actually set (don't fallback to tenant.name)
      const result: any = {
        companyDisplayName: settings.companyDisplayName || null,
        tenantName: tenant?.name,
        logoSignedUrl: null,
      }

      if (settings.logoUrl) {
        try {
          result.logoSignedUrl = await getFileUrl(settings.logoUrl, 3600)
        } catch (error) {
          console.error('Error generating logo signed URL:', error)
        }
      }

      return result
    },
    update: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)

      // Ensure settings exist
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      if (!settings) {
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            ...payload,
          },
        })
      } else {
        settings = await prisma.tenantSettings.update({
          where: { tenantId },
          data: payload,
        })
      }

      return settings
    },
    getUploadUrl: async (
      tenantId: string,
      payload: { type: 'logo' | 'invoice-pdf' | 'quote-pdf'; filename: string; contentType: string }
    ) => {
      await ensureTenantExists(tenantId)

      const { type, filename, contentType } = payload

      // Validate file type based on upload type
      if (type === 'logo') {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
        if (!allowedTypes.includes(contentType)) {
          throw new ApiError(
            'Invalid file type. Only PNG, JPEG, and SVG are allowed for logos.',
            400
          )
        }
      } else {
        if (contentType !== 'application/pdf') {
          throw new ApiError('Invalid file type. Only PDF files are allowed for templates.', 400)
        }
      }

      // Generate unique key
      const { randomUUID } = await import('crypto')
      // Sanitize the client-supplied extension so it can't inject path segments into the key.
      const rawExt = (filename?.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : type === 'logo' ? 'png' : 'pdf'
      const folder =
        type === 'logo'
          ? `logos/${tenantId}`
          : `pdf-templates/${tenantId}/${type.replace('-pdf', 's')}`
      const key = `${folder}/${randomUUID()}.${ext}`

      // Generate pre-signed URL for upload
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
      const FILES_BUCKET = process.env.FILES_BUCKET || ''

      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: FILES_BUCKET,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: 300 } // 5 minutes
      )

      return {
        uploadUrl,
        key,
        type,
      }
    },
    confirmUpload: async (
      tenantId: string,
      payload: { key: string; type: 'logo' | 'invoice-pdf' | 'quote-pdf' }
    ) => {
      await ensureTenantExists(tenantId)

      const { key, type } = payload

      // The key is client-supplied after the presigned upload. It MUST live under this
      // tenant's own prefix (the only place getUploadUrl signs a PUT), otherwise a tenant
      // could point its logo/template at another tenant's S3 object and read it via the
      // signed URL returned below.
      const expectedPrefix = type === 'logo' ? `logos/${tenantId}/` : `pdf-templates/${tenantId}/`
      if (typeof key !== 'string' || !key.startsWith(expectedPrefix)) {
        throw new ApiError('Invalid file key', 400)
      }

      // Get existing settings to delete old file if it exists
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      let oldKey: string | null = null
      let updateData: any = {}

      if (type === 'logo') {
        oldKey = settings?.logoUrl || null
        updateData.logoUrl = key
      } else if (type === 'invoice-pdf') {
        oldKey = settings?.invoicePdfTemplateKey || null
        updateData.invoicePdfTemplateKey = key
      } else if (type === 'quote-pdf') {
        oldKey = settings?.quotePdfTemplateKey || null
        updateData.quotePdfTemplateKey = key
      }

      // Delete old file if it exists
      if (oldKey) {
        try {
          await deleteFile(oldKey)
        } catch (error) {
          console.error(`Error deleting old ${type}:`, error)
        }
      }

      // Update settings with new file key
      const updatedSettings = await dataServices.settings.update(tenantId, updateData)

      // Generate signed URL for the new file
      const signedUrl = await getFileUrl(key, 3600)

      return {
        ...updatedSettings,
        ...(type === 'logo' && { logoSignedUrl: signedUrl }),
        ...(type === 'invoice-pdf' && { invoicePdfSignedUrl: signedUrl }),
        ...(type === 'quote-pdf' && { quotePdfSignedUrl: signedUrl }),
      }
    },
    submitFeedback: async (
      _tenantId: string,
      payload: {
        category: 'problem' | 'suggestion'
        message: string
        userEmail?: string
        userName?: string
      }
    ) => {
      const { category, message, userEmail, userName } = payload
      if (!category || !message?.trim()) {
        throw new ApiError('Category and message are required', 400)
      }
      const categoryLabel = category === 'problem' ? 'Report a Problem' : 'Suggest a Change/Feature'
      const subject = `[JobDock Feedback] ${categoryLabel} - ${userName || userEmail || 'Anonymous'}`
      const textBody = `Category: ${categoryLabel}\n\nFrom: ${userName || 'Unknown'} (${userEmail || 'Unknown'})\n\nMessage:\n${message}`
      const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      const htmlBody = `<pre style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(textBody)}</pre>`
      await sendEmail({
        to: 'jordan@westwavecreative.com',
        subject,
        htmlBody,
        textBody,
        replyTo: userEmail || undefined,
      })
      return { success: true }
    },
  },
  contacts: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      return prisma.contact.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
    },
    getById: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
      })
      if (!contact) {
        throw new Error('Contact not found')
      }
      return contact
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      return prisma.contact.create({
        data: {
          tenantId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          company: payload.company,
          jobTitle: payload.jobTitle,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          zipCode: payload.zipCode,
          country: payload.country ?? 'USA',
          tags: payload.tags ?? [],
          notes: payload.notes,
          status: payload.status ?? 'customer',
        },
      })
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      // Verify contact belongs to tenant before updating
      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
      })
      if (!contact) {
        throw new ApiError('Contact not found', 404)
      }
      // Convert empty strings to null for optional fields so clearing works (undefined is stripped from JSON)
      const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : (v as string))
      const data: Record<string, unknown> = {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: emptyToNull(payload.email),
        phone: emptyToNull(payload.phone),
        company: emptyToNull(payload.company),
        jobTitle: emptyToNull(payload.jobTitle),
        address: emptyToNull(payload.address),
        city: emptyToNull(payload.city),
        state: emptyToNull(payload.state),
        zipCode: emptyToNull(payload.zipCode),
        country: payload.country ?? undefined,
        tags: payload.tags ?? undefined,
        notes: payload.notes ?? undefined,
        status: payload.status ?? undefined,
        notificationPreference: payload.notificationPreference ?? undefined,
      }
      // Omit undefined so Prisma only updates provided fields
      const prune = (obj: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Record<
          string,
          unknown
        >
      return prisma.contact.update({
        where: { id },
        data: prune(data),
      })
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      return prisma.$transaction(async tx => {
        const contact = await tx.contact.findFirst({
          where: { id, tenantId },
          select: { id: true },
        })

        if (!contact) {
          throw new ApiError('Contact not found', 404)
        }

        const quoteIds = await tx.quote.findMany({
          where: { contactId: id, tenantId },
          select: { id: true },
        })

        const invoiceIds = await tx.invoice.findMany({
          where: { contactId: id, tenantId },
          select: { id: true },
        })

        const quoteIdList = quoteIds.map(record => record.id)
        const invoiceIdList = invoiceIds.map(record => record.id)

        const [
          deletedQuoteLineItems,
          deletedInvoiceLineItems,
          deletedPayments,
          deletedQuotes,
          deletedInvoices,
          deletedJobs,
          deletedJobRecurrences,
        ] = await Promise.all([
          quoteIdList.length
            ? tx.quoteLineItem.deleteMany({ where: { quoteId: { in: quoteIdList } } })
            : Promise.resolve({ count: 0 }),
          invoiceIdList.length
            ? tx.invoiceLineItem.deleteMany({ where: { invoiceId: { in: invoiceIdList } } })
            : Promise.resolve({ count: 0 }),
          invoiceIdList.length
            ? tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIdList } } })
            : Promise.resolve({ count: 0 }),
          tx.quote.deleteMany({ where: { id: { in: quoteIdList } } }),
          tx.invoice.deleteMany({ where: { id: { in: invoiceIdList } } }),
          tx.job.deleteMany({ where: { contactId: id, tenantId } }),
          tx.jobRecurrence.deleteMany({ where: { contactId: id, tenantId } }),
        ])

        await tx.contact.delete({ where: { id } })

        return {
          success: true,
          deleted: {
            quoteLineItems: deletedQuoteLineItems.count,
            quotes: deletedQuotes.count,
            invoiceLineItems: deletedInvoiceLineItems.count,
            payments: deletedPayments.count,
            invoices: deletedInvoices.count,
            jobs: deletedJobs.count,
            jobRecurrences: deletedJobRecurrences.count,
          },
        }
      })
    },
    // CSV Import methods
    importPreview: async (tenantId: string, payload: { csvContent: string }) => {
      console.log('[CSV IMPORT v2.0] importPreview called', {
        tenantId,
        contentLength: payload?.csvContent?.length,
      })
      await ensureTenantExists(tenantId)
      console.log('[CSV IMPORT v2.0] Tenant exists, calling parseCSVPreview')
      const result = parseCSVPreview(payload.csvContent)
      console.log('[CSV IMPORT v2.0] parseCSVPreview result:', {
        headers: result.headers,
        totalRows: result.totalRows,
        suggestedMapping: result.suggestedMapping,
      })
      return result
    },
    importInit: async (
      tenantId: string,
      payload: { fileName: string; csvContent: string; fieldMapping: Record<string, string> }
    ) => {
      await ensureTenantExists(tenantId)
      const session = createImportSession(
        tenantId,
        payload.fileName,
        payload.csvContent,
        payload.fieldMapping
      )
      return { sessionId: session.id }
    },
    importProcess: async (tenantId: string, sessionId: string) => {
      await ensureTenantExists(tenantId)
      const session = getImportSession(sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      return await processImportSession(sessionId)
    },
    importStatus: async (tenantId: string, sessionId: string) => {
      await ensureTenantExists(tenantId)
      const session = getImportSession(sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      return getImportSessionData(sessionId)
    },
    importResolveConflict: async (
      tenantId: string,
      payload: {
        sessionId: string
        conflictId: string
        resolution: 'update' | 'skip' | 'keep_existing' | 'keep_incoming' | 'keep_both'
      }
    ) => {
      await ensureTenantExists(tenantId)
      const session = getImportSession(payload.sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      await resolveConflict(payload.sessionId, payload.conflictId, payload.resolution)
      return getImportSessionData(payload.sessionId)
    },
  },
  quotes: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      const quotes = await prisma.quote.findMany({
        where: { tenantId },
        include: { contact: true, lineItems: true },
        orderBy: { createdAt: 'desc' },
      })
      return quotes.map(serializeQuote)
    },
    getById: async (tenantId: string, id: string) => {
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!quote) throw new Error('Quote not found')
      return serializeQuote(quote)
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const quoteNumber = payload.quoteNumber || (await generateSequentialNumber(tenantId, 'quote'))
      const lineItems = payload.lineItems || []
      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0
      )
      const taxRate = payload.taxRate || 0
      const taxAmount = subtotal * taxRate
      const discount = payload.discount || 0

      if (!payload.validUntil) {
        throw new ApiError('Valid Until date is required', 400)
      }
      if (!payload.title?.trim()) {
        throw new ApiError('Quote title is required', 400)
      }
      const created = await prisma.quote.create({
        data: {
          tenantId,
          quoteNumber,
          title: payload.title || null,
          contactId: payload.contactId,
          subtotal,
          taxRate,
          taxAmount,
          discount,
          discountReason: payload.discountReason || null,
          total: subtotal + taxAmount - discount,
          status: payload.status || 'draft',
          notes: payload.notes,
          validUntil: new Date(payload.validUntil),
          lineItems: {
            create: lineItems.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { contact: true, lineItems: true },
      })

      return serializeQuote(created)
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      // Verify quote belongs to tenant before updating
      const existingQuote = await prisma.quote.findFirst({
        where: { id, tenantId },
      })
      if (!existingQuote) {
        throw new ApiError('Quote not found', 404)
      }

      // Destructure to separate lineItems from other fields
      const { lineItems, ...updateData } = payload
      if ('validUntil' in payload && !payload.validUntil) {
        throw new ApiError('Valid Until date is required', 400)
      }
      if ('title' in payload && !payload.title?.trim()) {
        throw new ApiError('Quote title is required', 400)
      }
      const subtotal = lineItems
        ? lineItems.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)
        : undefined
      const taxRate = payload.taxRate
      const discount = payload.discount
      const taxAmount =
        subtotal !== undefined && taxRate !== undefined ? subtotal * taxRate : undefined
      const total =
        subtotal !== undefined && taxRate !== undefined && discount !== undefined
          ? subtotal + subtotal * taxRate - discount
          : undefined

      await prisma.$transaction(async tx => {
        if (lineItems) {
          await tx.quoteLineItem.deleteMany({ where: { quoteId: id } })
          await tx.quoteLineItem.createMany({
            data: lineItems.map((item: any) => ({
              quoteId: id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          })
        }

        await tx.quote.update({
          where: { id },
          data: {
            contactId: updateData.contactId,
            title: updateData.title,
            status: updateData.status,
            notes: updateData.notes,
            validUntil: updateData.validUntil ? new Date(updateData.validUntil) : undefined,
            subtotal: subtotal ?? undefined,
            taxRate: taxRate ?? undefined,
            taxAmount: taxAmount ?? undefined,
            discount: discount ?? undefined,
            discountReason:
              payload.discountReason !== undefined ? payload.discountReason || null : undefined,
            total,
          },
        })
      })

      const updated = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!updated) throw new Error('Quote not found')
      return serializeQuote(updated)
    },
    delete: async (tenantId: string, id: string) => {
      // Verify quote belongs to tenant before deleting
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
      })
      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }
      await prisma.quote.delete({ where: { id } })
      return { success: true }
    },
    send: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      // Load quote with contact and line items
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }

      const pref = (quote.contact as any)?.notificationPreference ?? 'both'
      const wantsEmail = shouldSendEmail(pref)
      const wantsSms = shouldSendSms(pref)

      if (wantsEmail && !quote.contact.email) {
        throw new ApiError('Contact does not have an email address', 400)
      }
      if (wantsSms && !quote.contact.phone?.trim()) {
        throw new ApiError('Contact does not have a phone number for SMS', 400)
      }
      if (!wantsEmail && !wantsSms) {
        throw new ApiError('Contact has no valid notification preference', 400)
      }

      // Serialize the quote for email
      const serializedQuote = serializeQuote(quote)

      // Get tenant settings for company name
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      const companyName = settings?.companyDisplayName || tenant?.name || 'JobDock'

      // Generate token for email and/or SMS link
      const approvalToken = generateApprovalToken('quote', quote.id, tenantId)
      const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
      const viewUrl = `${publicAppUrl}/public/quote/${quote.id}?token=${approvalToken}`

      const sentVia: string[] = []

      try {
        if (wantsEmail && quote.contact.email) {
          await sendQuoteEmail({
            quoteData: serializedQuote,
            tenantName: tenant?.name ?? undefined,
            tenantId,
            approvalToken,
          })
          sentVia.push('email')
          console.log(`[OK] Quote ${quote.quoteNumber} email sent to ${quote.contact.email}`)
        }
        if (wantsSms && quote.contact.phone?.trim()) {
          const { isSmsConfigured } = await import('./sms')
          const { createShortLink } = await import('./shortLinks')
          console.log(
            `[QUOTE-SEND] Attempting SMS for ${quote.quoteNumber}, isSmsConfigured: ${isSmsConfigured()}`
          )
          const smsViewUrl = await createShortLink(viewUrl)
          const smsBody = buildQuoteNotificationSms({
            quoteNumber: quote.quoteNumber,
            companyName,
            viewUrl: smsViewUrl,
          })
          const smsSid = await sendSms(quote.contact.phone, smsBody)
          if (smsSid) {
            sentVia.push('sms')
            console.log(`[OK] Quote ${quote.quoteNumber} SMS sent to ${quote.contact.phone}`)
          } else {
            console.warn(
              `[WARN] Quote ${quote.quoteNumber} SMS skipped or failed for ${quote.contact.phone}`
            )
          }
        }
      } catch (err) {
        console.error('[ERROR] Failed to send quote:', err)
        throw new ApiError(
          `Failed to send quote: ${err instanceof Error ? err.message : 'Unknown error'}`,
          500
        )
      }

      // Update quote status to 'sent'
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'sent' },
        include: { contact: true, lineItems: true },
      })

      return { ...serializeQuote(updatedQuote), sentVia }
    },
    approve: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }

      // Only allow approval if quote is in 'sent' status
      if (quote.status !== 'sent') {
        if (quote.status === 'accepted') {
          throw new ApiError(
            'You have already accepted this quote. The contractor has been notified.',
            400
          )
        } else if (quote.status === 'rejected') {
          throw new ApiError(
            "You have already declined this quote. Please contact the contractor if you've changed your mind.",
            400
          )
        }
        throw new ApiError(
          'This quote can no longer be responded to. Please contact the contractor for assistance.',
          400
        )
      }

      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'accepted' },
        include: { contact: true, lineItems: true },
      })

      console.log(`✅ Quote ${quote.quoteNumber} approved by client`)

      // Notify JobDock users via email
      try {
        const contact = updatedQuote.contact
        const clientName = contact
          ? `${(contact as any).firstName || ''} ${(contact as any).lastName || ''}`.trim() ||
            'Client'
          : 'Client'
        await sendQuoteAcceptedNotificationToUsers({
          tenantId,
          quoteNumber: updatedQuote.quoteNumber,
          clientName,
          total: Number(updatedQuote.total),
        })
      } catch (err) {
        console.error('Failed to send quote acceptance notifications:', err)
      }

      return {
        ...serializeQuote(updatedQuote),
        tenantId,
      }
    },
    decline: async (tenantId: string, id: string, declineReason?: unknown) => {
      await ensureTenantExists(tenantId)

      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }

      const storedDeclineReason = normalizeClientDeclineReason(declineReason)

      // Only allow declining if quote is in 'sent' status
      if (quote.status !== 'sent') {
        if (quote.status === 'accepted') {
          throw new ApiError(
            'You have already accepted this quote. Please contact the contractor if you need to cancel.',
            400
          )
        } else if (quote.status === 'rejected') {
          throw new ApiError(
            'You have already declined this quote. The contractor has been notified.',
            400
          )
        }
        throw new ApiError(
          'This quote can no longer be responded to. Please contact the contractor for assistance.',
          400
        )
      }

      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'rejected', clientDeclineReason: storedDeclineReason },
        include: { contact: true, lineItems: true },
      })

      console.log(`✅ Quote ${quote.quoteNumber} declined by client`)

      // Notify admins/owner via email
      try {
        const contact = updatedQuote.contact
        const clientName = contact
          ? `${(contact as any).firstName || ''} ${(contact as any).lastName || ''}`.trim() ||
            'Client'
          : 'Client'
        await sendQuoteDeclinedNotificationToAdmins({
          tenantId,
          quoteNumber: updatedQuote.quoteNumber,
          clientName,
          total: Number(updatedQuote.total),
          declineReason: storedDeclineReason ?? undefined,
        })
      } catch (err) {
        console.error('Failed to send quote decline notifications:', err)
      }

      return {
        ...serializeQuote(updatedQuote),
        tenantId,
      }
    },
  },
  invoices: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)

      // Update overdue invoices automatically
      // An invoice is overdue if:
      // 1. It has a due date
      // 2. The due date is more than 1 day in the past (not just today)
      // 3. Payment status is not 'paid'
      // 4. Current status is 'sent' (not already overdue, cancelled, or draft)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      oneDayAgo.setHours(23, 59, 59, 999) // End of yesterday

      await prisma.invoice.updateMany({
        where: {
          tenantId,
          status: 'sent',
          paymentStatus: { not: 'paid' },
          dueDate: {
            lt: oneDayAgo,
          },
        },
        data: {
          status: 'overdue',
        },
      })

      const invoices = await prisma.invoice.findMany({
        where: { tenantId },
        include: { contact: true, lineItems: true },
        orderBy: { createdAt: 'desc' },
      })
      return invoices.map(serializeInvoice)
    },
    getById: async (tenantId: string, id: string) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!invoice) throw new Error('Invoice not found')

      // Check if this invoice should be marked as overdue
      if (invoice.status === 'sent' && invoice.paymentStatus !== 'paid' && invoice.dueDate) {
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)
        oneDayAgo.setHours(23, 59, 59, 999)

        if (invoice.dueDate < oneDayAgo) {
          // Update to overdue
          await prisma.invoice.update({
            where: { id },
            data: { status: 'overdue' },
          })
          invoice.status = 'overdue'
        }
      }

      return serializeInvoice(invoice)
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const invoiceNumber =
        payload.invoiceNumber || (await generateSequentialNumber(tenantId, 'invoice'))
      const lineItems = payload.lineItems || []
      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0
      )
      const taxRate = payload.taxRate || 0
      const taxAmount = subtotal * taxRate
      const discount = payload.discount || 0
      const total = subtotal + taxAmount - discount
      const paymentStatus = payload.paymentStatus || 'pending'
      const paidAmount =
        paymentStatus === 'paid' ? total : paymentStatus === 'partial' ? payload.paidAmount || 0 : 0

      if (!payload.title?.trim()) {
        throw new ApiError('Invoice title is required', 400)
      }

      const created = await prisma.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          title: payload.title || null,
          contactId: payload.contactId,
          subtotal,
          taxRate,
          taxAmount,
          discount,
          discountReason: payload.discountReason || null,
          total,
          status: payload.status || 'draft',
          paymentStatus,
          notes: payload.notes,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          paymentTerms: payload.paymentTerms || 'Net 30',
          paidAmount,
          trackResponse: payload.trackResponse !== undefined ? payload.trackResponse : true,
          trackPayment: payload.trackPayment !== undefined ? payload.trackPayment : true,
          convertedFromQuoteNumber: payload.convertedFromQuoteNumber || null,
          convertedFromQuoteTotal:
            payload.convertedFromQuoteTotal != null ? payload.convertedFromQuoteTotal : null,
          convertedFromQuoteCreatedAt: payload.convertedFromQuoteCreatedAt
            ? new Date(payload.convertedFromQuoteCreatedAt)
            : null,
          lineItems: {
            create: lineItems.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { contact: true, lineItems: true },
      })

      return serializeInvoice(created)
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      // Verify invoice belongs to tenant before updating
      const existingInvoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      })
      if (!existingInvoice) {
        throw new ApiError('Invoice not found', 404)
      }

      const { lineItems, ...restPayload } = payload
      if ('title' in payload && !payload.title?.trim()) {
        throw new ApiError('Invoice title is required', 400)
      }

      // Totals: recalc from payload line items only when lineItems is sent; otherwise keep stored
      // subtotal (e.g. paymentStatus-only updates must not use `lineItems || []`, which is empty).
      let subtotal: number
      if (lineItems !== undefined) {
        subtotal = lineItems.reduce(
          (sum: number, item: any) => sum + (item.quantity || 0) * (item.unitPrice || 0),
          0
        )
      } else {
        subtotal = Number(existingInvoice.subtotal)
      }
      const taxRate = payload.taxRate !== undefined ? payload.taxRate : existingInvoice.taxRate
      const taxAmount = subtotal * Number(taxRate)
      const discount = payload.discount !== undefined ? payload.discount : existingInvoice.discount
      const total = subtotal + taxAmount - Number(discount)

      // Calculate paidAmount based on paymentStatus
      const paymentStatus = payload.paymentStatus || existingInvoice.paymentStatus
      const paidAmount =
        paymentStatus === 'paid'
          ? total
          : paymentStatus === 'partial'
            ? payload.paidAmount !== undefined
              ? payload.paidAmount
              : existingInvoice.paidAmount
            : 0

      await prisma.$transaction(async tx => {
        if (lineItems) {
          await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } })
          await tx.invoiceLineItem.createMany({
            data: lineItems.map((item: any) => ({
              invoiceId: id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          })
        }

        await tx.invoice.update({
          where: { id },
          data: {
            title: payload.title !== undefined ? payload.title || null : undefined,
            contactId: payload.contactId,
            subtotal,
            taxRate,
            taxAmount,
            discount,
            discountReason:
              payload.discountReason !== undefined ? payload.discountReason || null : undefined,
            total,
            status: payload.status,
            paymentStatus,
            approvalStatus:
              payload.approvalStatus !== undefined ? payload.approvalStatus : undefined,
            notes: payload.notes !== undefined ? payload.notes || null : undefined,
            dueDate:
              payload.dueDate !== undefined
                ? payload.dueDate
                  ? new Date(payload.dueDate)
                  : null
                : undefined,
            paymentTerms:
              payload.paymentTerms !== undefined ? payload.paymentTerms || null : undefined,
            paidAmount,
            trackResponse: payload.trackResponse !== undefined ? payload.trackResponse : undefined,
            trackPayment: payload.trackPayment !== undefined ? payload.trackPayment : undefined,
          } as any,
        })
      })

      const updated = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!updated) throw new Error('Invoice not found')
      return serializeInvoice(updated)
    },
    delete: async (tenantId: string, id: string) => {
      // Verify invoice belongs to tenant before deleting
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      })
      if (!invoice) {
        throw new ApiError('Invoice not found', 404)
      }
      await prisma.invoice.delete({ where: { id } })
      return { success: true }
    },
    send: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      // Load invoice with contact and line items
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!invoice) {
        throw new ApiError('Invoice not found', 404)
      }

      const pref = (invoice.contact as any)?.notificationPreference ?? 'both'
      const wantsEmail = shouldSendEmail(pref)
      const wantsSms = shouldSendSms(pref)

      if (wantsEmail && !invoice.contact.email) {
        throw new ApiError('Contact does not have an email address', 400)
      }
      if (wantsSms && !invoice.contact.phone?.trim()) {
        throw new ApiError('Contact does not have a phone number for SMS', 400)
      }
      if (!wantsEmail && !wantsSms) {
        throw new ApiError('Contact has no valid notification preference', 400)
      }

      // QuickBooks: when the tenant has QuickBooks connected with Payments enabled, push the invoice
      // to QuickBooks first so the email/SMS can carry a real Intuit "Pay Now" link. Best-effort —
      // never block the send if QuickBooks is unavailable or the invoice can't be synced.
      let invoiceForSend = invoice
      try {
        const quickbooks = await import('./quickbooks')
        const qbStatus = await quickbooks.getStatus(tenantId)
        if (qbStatus.connected && qbStatus.paymentsConnected) {
          await quickbooks.syncInvoice(tenantId, id, { sendEmail: false })
          const refreshed = await prisma.invoice.findFirst({
            where: { id, tenantId },
            include: { contact: true, lineItems: true },
          })
          if (refreshed) invoiceForSend = refreshed
        }
      } catch (err) {
        console.error(
          '[WARN] QuickBooks sync before invoice send failed; sending without a pay link:',
          err instanceof Error ? err.message : err
        )
      }

      // Serialize the invoice for email (reflects any fresh QuickBooks pay link from the sync above)
      const serializedInvoice = serializeInvoice(invoiceForSend)

      // Get tenant settings for company name
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      const companyName = settings?.companyDisplayName || tenant?.name || 'JobDock'

      // Invoices always get a branded public view link — the client's path to the QuickBooks "Pay
      // Now" button. The approval token secures the public page (accept/decline is no longer offered
      // for invoices, but the same token mechanism authorizes the public view).
      const approvalToken = generateApprovalToken('invoice', invoice.id, tenantId)
      const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
      const viewUrl = `${publicAppUrl}/public/invoice/${invoice.id}?token=${approvalToken}`

      const sentVia: string[] = []

      try {
        if (wantsEmail && invoice.contact.email) {
          await sendInvoiceEmail({
            invoiceData: serializedInvoice,
            tenantName: tenant?.name ?? undefined,
            tenantId,
            approvalToken,
          })
          sentVia.push('email')
          console.log(
            `[OK] Invoice ${invoice.invoiceNumber} email sent to ${invoice.contact.email}`
          )
        }
        if (wantsSms && invoice.contact.phone?.trim()) {
          const { createShortLink } = await import('./shortLinks')
          const { isUsablePayUrl } = await import('./quickbooks/config')
          const smsViewUrl = viewUrl ? await createShortLink(viewUrl) : undefined
          const canPay =
            serializedInvoice.paymentStatus !== 'paid' &&
            isUsablePayUrl(serializedInvoice.quickbooksInvoiceUrl)
          const smsBody = buildInvoiceNotificationSms({
            invoiceNumber: invoice.invoiceNumber,
            companyName,
            viewUrl: smsViewUrl,
            canPay,
          })
          const smsSid = await sendSms(invoice.contact.phone, smsBody)
          if (smsSid) {
            sentVia.push('sms')
            console.log(
              `[OK] Invoice ${invoice.invoiceNumber} SMS sent to ${invoice.contact.phone}`
            )
          } else {
            console.warn(
              `[WARN] Invoice ${invoice.invoiceNumber} SMS skipped or failed for ${invoice.contact.phone}`
            )
          }
        }
      } catch (err) {
        console.error('[ERROR] Failed to send invoice:', err)
        throw new ApiError(
          `Failed to send invoice: ${err instanceof Error ? err.message : 'Unknown error'}`,
          500
        )
      }

      // Update invoice status to 'sent'
      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { status: 'sent' },
        include: { contact: true, lineItems: true },
      })

      return { ...serializeInvoice(updatedInvoice), sentVia }
    },
    setApprovalStatus: async (
      tenantId: string,
      id: string,
      approvalStatus: 'accepted' | 'declined',
      declineReason?: unknown
    ) => {
      await ensureTenantExists(tenantId)

      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!invoice) {
        throw new ApiError('Invoice not found', 404)
      }

      // Check if invoice has already been responded to
      const currentStatus = (invoice as any).approvalStatus
      if (currentStatus && currentStatus !== 'none') {
        if (currentStatus === approvalStatus) {
          const action = approvalStatus === 'accepted' ? 'approved' : 'reported an issue with'
          throw new ApiError(
            `You have already ${action} this invoice. The contractor has been notified.`,
            400
          )
        } else {
          const previousAction =
            currentStatus === 'accepted' ? 'approved' : 'reported an issue with'
          throw new ApiError(
            `You have already ${previousAction} this invoice. Please contact the contractor if you need to make changes.`,
            400
          )
        }
      }

      const storedDeclineReason =
        approvalStatus === 'declined' ? normalizeClientDeclineReason(declineReason) : null

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: {
          approvalStatus: approvalStatus,
          approvalAt: new Date(),
          ...(approvalStatus === 'declined' ? { clientDeclineReason: storedDeclineReason } : {}),
        } as any,
        include: { contact: true, lineItems: true },
      })

      console.log(`✅ Invoice ${invoice.invoiceNumber} ${approvalStatus} by client`)

      // Notify via email when client responds (accepted/declined)
      if (approvalStatus === 'accepted') {
        try {
          const contact = updatedInvoice.contact
          const clientName = contact
            ? `${(contact as any).firstName || ''} ${(contact as any).lastName || ''}`.trim() ||
              'Client'
            : 'Client'
          await sendInvoiceAcceptedNotificationToUsers({
            tenantId,
            invoiceNumber: updatedInvoice.invoiceNumber,
            clientName,
            total: Number(updatedInvoice.total),
          })
        } catch (err) {
          console.error('Failed to send invoice acceptance notifications:', err)
        }
      } else if (approvalStatus === 'declined') {
        try {
          const contact = updatedInvoice.contact
          const clientName = contact
            ? `${(contact as any).firstName || ''} ${(contact as any).lastName || ''}`.trim() ||
              'Client'
            : 'Client'
          await sendInvoiceDeclinedNotificationToAdmins({
            tenantId,
            invoiceNumber: updatedInvoice.invoiceNumber,
            clientName,
            total: Number(updatedInvoice.total),
            declineReason: storedDeclineReason ?? undefined,
          })
        } catch (err) {
          console.error('Failed to send invoice decline notifications:', err)
        }
      }

      return {
        ...serializeInvoice(updatedInvoice),
        tenantId,
      }
    },
    getUnconvertedAcceptedQuotes: async (tenantId: string) => {
      await ensureTenantExists(tenantId)

      // Get all accepted quotes
      const acceptedQuotes = await prisma.quote.findMany({
        where: {
          tenantId,
          status: 'accepted',
        },
        include: {
          contact: true,
          lineItems: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      // Get all invoices to check which quotes have been converted
      const invoices = await prisma.invoice.findMany({
        where: { tenantId },
        select: { notes: true },
      })

      // Create a set of quote numbers that have been converted
      const convertedQuoteNumbers = new Set<string>()
      for (const invoice of invoices) {
        if (invoice.notes && typeof invoice.notes === 'string') {
          // Check if notes contain "Converted from {quoteNumber}"
          // Handle both single line and multi-line notes
          const match = invoice.notes.match(/Converted from ([A-Z0-9-]+)/i)
          if (match && match[1]) {
            convertedQuoteNumbers.add(match[1])
          }
        }
      }

      // Filter out quotes that have been converted
      const unconvertedQuotes = acceptedQuotes.filter(
        quote => !convertedQuoteNumbers.has(quote.quoteNumber)
      )

      // Serialize quotes - contact can be null/undefined, serializeQuote handles it
      return unconvertedQuotes.map(serializeQuote)
    },
  },
  jobs: {
    getAll: async (
      tenantId: string,
      startDate?: Date,
      endDate?: Date,
      includeArchived?: boolean,
      showDeleted?: boolean,
      currentUserId?: string,
      currentUserRole?: string,
      canSeeOtherJobs?: boolean,
      includeUnlinkedJobs?: boolean
    ) => {
      await ensureTenantExists(tenantId)

      // Fetch Bookings (for calendar) - bookings have startTime, endTime
      const bookingWhere: Prisma.BookingWhereInput = {
        tenantId,
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(showDeleted ? {} : { deletedAt: null }),
      }

      if (startDate || endDate) {
        bookingWhere.OR = [
          {
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            toBeScheduled: true,
          },
        ]
      }

      const bookings = await prisma.booking.findMany({
        where: bookingWhere,
        include: {
          job: {
            include: {
              contact: true,
              createdBy: { select: { name: true } },
            },
          },
          contact: true,
          service: true,
          createdBy: { select: { name: true } },
        },
        orderBy: [{ toBeScheduled: 'desc' }, { startTime: 'asc' }],
      })

      // Filter bookings by user visibility
      let filteredBookings = bookings
      if (currentUserId && canSeeOtherJobs !== true) {
        filteredBookings = bookings.filter(b => {
          const job = b.job
          if (b.isIndependent) {
            if (b.createdById === currentUserId) return true
            const userIds = extractUserIds(b.assignedTo)
            return userIds.includes(currentUserId)
          }
          if (job!.createdById === currentUserId) return true
          const userIds = extractUserIds(b.assignedTo ?? job!.assignedTo)
          return userIds.includes(currentUserId)
        })
      }

      // Series sizes for every recurrence visible in this page. occurrenceCount counts bookings
      // not hard-deleted (archived siblings included) so the recurring-aware delete/edit modals
      // fire on calendar rows AND on archived rows; the frontend keys off occurrenceCount > 1.
      const visibleRecurrenceIds = Array.from(
        new Set(filteredBookings.map(b => b.recurrenceId).filter((v): v is string => !!v))
      )
      const occurrenceCountByRecurrence = new Map<string, number>()
      if (visibleRecurrenceIds.length > 0) {
        const occurrenceCounts = await prisma.booking.groupBy({
          by: ['recurrenceId'],
          where: { tenantId, recurrenceId: { in: visibleRecurrenceIds }, deletedAt: null },
          _count: { _all: true },
        })
        for (const c of occurrenceCounts) {
          if (c.recurrenceId) occurrenceCountByRecurrence.set(c.recurrenceId, c._count._all)
        }
      }

      // Flatten Bookings to Job-like shape (handles both job-backed and independent appointments)
      const jobsFromBookings = await Promise.all(
        filteredBookings.map(async b => {
          const job = b.job
          const isIndependent = b.isIndependent || !job
          const assignedToName = await getAssignedToName(
            tenantId,
            b.assignedTo ?? (job as any)?.assignedTo
          )
          const assignedToWithPrivacy = getAssignedToWithPrivacy(
            b.assignedTo ?? (job as any)?.assignedTo,
            currentUserId,
            currentUserRole
          )
          const contactName = (job as any)?.contact
            ? `${(job as any).contact.firstName ?? ''} ${(job as any).contact.lastName ?? ''}`.trim()
            : (b as any).contact
              ? `${(b as any).contact.firstName ?? ''} ${(b as any).contact.lastName ?? ''}`.trim()
              : undefined
          return {
            id: isIndependent ? b.id : job!.id,
            tenantId: isIndependent ? b.tenantId : job!.tenantId,
            title: isIndependent ? (b.title ?? 'Untitled') : job!.title,
            description: isIndependent ? undefined : job!.description,
            contactId: isIndependent ? (b.contactId ?? undefined) : job!.contactId,
            contactName,
            serviceId: b.serviceId,
            serviceName: b.service?.name,
            quoteId: b.quoteId ?? (job as any)?.quoteId ?? undefined,
            invoiceId: b.invoiceId ?? (job as any)?.invoiceId ?? undefined,
            recurrenceId: b.recurrenceId,
            occurrenceCount: b.recurrenceId
              ? (occurrenceCountByRecurrence.get(b.recurrenceId) ?? 1)
              : 1,
            startTime: b.startTime?.toISOString() ?? null,
            endTime: b.endTime?.toISOString() ?? null,
            toBeScheduled: b.toBeScheduled,
            status: b.status,
            location: b.location ?? (job as any)?.location ?? undefined,
            price: b.price != null ? Number(b.price) : null,
            notes: b.notes ?? (job as any)?.notes ?? undefined,
            assignedTo: assignedToWithPrivacy ?? b.assignedTo ?? (job as any)?.assignedTo,
            assignedToName,
            bookingId: b.id,
            isIndependent: !!isIndependent,
            archivedAt:
              b.archivedAt?.toISOString() ?? (job as any)?.archivedAt?.toISOString() ?? null,
            deletedAt: b.deletedAt?.toISOString() ?? null,
            createdById: b.createdById ?? (job as any)?.createdById,
            createdByName: ((job as any)?.createdBy as any)?.name ?? (b.createdBy as any)?.name,
            createdAt: (isIndependent ? b.createdAt : job!.createdAt).toISOString(),
            updatedAt: (isIndependent ? b.updatedAt : job!.updatedAt).toISOString(),
          }
        })
      )

      // Staged monthly series: an ANCHOR booking (toBeScheduled === true && recurrenceId != null)
      // is the persistent marker of a "virtual per-month" series. Tag each anchor's flattened
      // row as a staged-series descriptor with the series START month ('YYYY-MM', from the
      // recurrence.startTime sentinel). The frontend uses this to render one virtual chip per
      // viewed month. Anchor detection keys off (toBeScheduled && recurrenceId) — NOT
      // recurrence.status — so legacy staged jobs from the earlier rolling model keep working
      // (normal pre-expanded recurring bookings are always toBeScheduled:false).
      const anchorRecurrenceIds = Array.from(
        new Set(
          jobsFromBookings
            .filter(j => j.toBeScheduled && j.recurrenceId)
            .map(j => j.recurrenceId as string)
        )
      )
      if (anchorRecurrenceIds.length > 0) {
        const recurrences = await prisma.jobRecurrence.findMany({
          where: { tenantId, id: { in: anchorRecurrenceIds } },
          select: { id: true, startTime: true, createdAt: true },
        })
        const toYearMonth = (d: Date) =>
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        const startMonthByRecurrence = new Map(
          recurrences.map(r => [r.id, toYearMonth(r.startTime ?? r.createdAt)])
        )
        for (const j of jobsFromBookings) {
          if (!(j.toBeScheduled && j.recurrenceId)) continue
          ;(j as { isStagedSeries?: boolean }).isStagedSeries = true
          ;(j as { seriesStartMonth?: string }).seriesStartMonth =
            startMonthByRecurrence.get(j.recurrenceId) ?? toYearMonth(new Date())
        }
      }

      const jobIdsWithBookings = new Set(
        bookings.map(b => b.jobId).filter((id): id is string => id != null)
      )

      // When includeArchived is set, also surface archived jobs that have no active bookings
      // (e.g. jobs archived from the Jobs page that never had a booking, or whose only
      // bookings are also archived). This keeps the calendar Archive tab in sync with
      // archives created from the Jobs page.
      if (!includeUnlinkedJobs && !includeArchived) {
        return jobsFromBookings
      }

      const jobsWithoutBookingsWhere: Prisma.JobWhereInput = {
        tenantId,
        id: { notIn: Array.from(jobIdsWithBookings) },
      }
      if (!includeUnlinkedJobs && includeArchived) {
        // Only pull bookingless jobs that are themselves archived
        jobsWithoutBookingsWhere.archivedAt = { not: null }
      }

      const jobsWithoutBookings = await prisma.job.findMany({
        where: jobsWithoutBookingsWhere,
        include: {
          contact: true,
          createdBy: { select: { name: true } },
          service: true,
          bookings: {
            where: {
              ...(includeArchived ? {} : { archivedAt: null }),
              ...(showDeleted ? {} : { deletedAt: null }),
            },
            include: { service: true },
            orderBy: { startTime: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      let filteredJobsWithoutBookings = jobsWithoutBookings
      if (currentUserId && canSeeOtherJobs !== true) {
        filteredJobsWithoutBookings = jobsWithoutBookings.filter(job => {
          if (job.createdById === currentUserId) return true
          const userIds = extractUserIds(job.assignedTo)
          return userIds.includes(currentUserId)
        })
      }
      // Series sizes for the bookingless/archived rows too (their recurrenceIds were not in the
      // booking-window sweep above).
      const extraRecurrenceIds = Array.from(
        new Set(
          filteredJobsWithoutBookings
            .map(j => j.bookings[0]?.recurrenceId)
            .filter((v): v is string => !!v && !occurrenceCountByRecurrence.has(v))
        )
      )
      if (extraRecurrenceIds.length > 0) {
        const extraCounts = await prisma.booking.groupBy({
          by: ['recurrenceId'],
          where: { tenantId, recurrenceId: { in: extraRecurrenceIds }, deletedAt: null },
          _count: { _all: true },
        })
        for (const c of extraCounts) {
          if (c.recurrenceId) occurrenceCountByRecurrence.set(c.recurrenceId, c._count._all)
        }
      }
      const jobsWithoutBookingsFormatted = await Promise.all(
        filteredJobsWithoutBookings.map(async job => {
          const firstBooking = job.bookings[0]
          const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
          const assignedToWithPrivacy = getAssignedToWithPrivacy(
            job.assignedTo,
            currentUserId,
            currentUserRole
          )
          return {
            id: job.id,
            tenantId: job.tenantId,
            title: job.title,
            description: job.description,
            contactId: job.contactId,
            contactName: job.contact
              ? `${job.contact.firstName ?? ''} ${job.contact.lastName ?? ''}`.trim()
              : undefined,
            serviceId: firstBooking?.serviceId ?? (job as any).serviceId ?? null,
            serviceName: firstBooking?.service?.name ?? (job as any).service?.name ?? undefined,
            quoteId: job.quoteId,
            invoiceId: job.invoiceId,
            recurrenceId: firstBooking?.recurrenceId ?? null,
            occurrenceCount: firstBooking?.recurrenceId
              ? (occurrenceCountByRecurrence.get(firstBooking.recurrenceId) ?? 1)
              : 1,
            startTime: firstBooking?.startTime?.toISOString() ?? null,
            endTime: firstBooking?.endTime?.toISOString() ?? null,
            toBeScheduled: firstBooking?.toBeScheduled ?? true,
            status: firstBooking?.status ?? job.status,
            location: job.location,
            price:
              firstBooking?.price != null
                ? Number(firstBooking.price)
                : (job as any).price != null
                  ? Number((job as any).price)
                  : null,
            notes: job.notes,
            assignedTo: assignedToWithPrivacy ?? job.assignedTo,
            assignedToName,
            bookingId: firstBooking?.id ?? null,
            archivedAt:
              firstBooking?.archivedAt?.toISOString() ?? job.archivedAt?.toISOString() ?? null,
            deletedAt: firstBooking?.deletedAt?.toISOString() ?? null,
            createdById: job.createdById,
            createdByName: (job.createdBy as any)?.name,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
          }
        })
      )
      // Deduplicate by job id - a job with multiple bookings should appear once in the link dropdown
      const seen = new Set<string>()
      const deduped = [...jobsFromBookings, ...jobsWithoutBookingsFormatted].filter(j => {
        if (seen.has(j.id)) return false
        seen.add(j.id)
        return true
      })
      return deduped
    },
    getById: async (
      tenantId: string,
      id: string,
      currentUserId?: string,
      currentUserRole?: string,
      canSeeOtherJobs?: boolean
    ) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          createdBy: { select: { name: true } },
          service: true,
          bookings: {
            include: { service: true },
            orderBy: { startTime: 'asc' },
          },
          timeEntries: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { startTime: 'desc' },
          },
        },
      })
      if (!job) throw new Error('Job not found')

      if (currentUserId && canSeeOtherJobs !== true) {
        const canSee =
          job.createdById === currentUserId ||
          extractUserIds(job.assignedTo).includes(currentUserId)
        if (!canSee) throw new Error('Job not found')
      }

      const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
      const assignedToWithPrivacy = getAssignedToWithPrivacy(
        job.assignedTo,
        currentUserId,
        currentUserRole
      )
      // Prefer the first LIVE booking as the representative. bookings[0] is merely the earliest by
      // start time and can be an archived/deleted occurrence — returning its id as bookingId would
      // let the assistant (or the detail view) act on an archived appointment instead of the live
      // one, and would surface the archived row's time/status. Fall back to bookings[0] only when
      // nothing is live (e.g. a fully series-deleted job), where there's no live appointment anyway.
      const primaryBooking =
        job.bookings.find(b => !b.archivedAt && !b.deletedAt) ?? job.bookings[0]
      const occurrenceCount = primaryBooking?.recurrenceId
        ? await prisma.booking.count({
            where: { tenantId, recurrenceId: primaryBooking.recurrenceId, deletedAt: null },
          })
        : 1
      return {
        ...job,
        assignedToName,
        assignedTo: assignedToWithPrivacy || job.assignedTo,
        bookingId: primaryBooking?.id ?? null,
        recurrenceId: primaryBooking?.recurrenceId ?? null,
        occurrenceCount,
        archivedAt:
          (job as any).archivedAt?.toISOString() ??
          primaryBooking?.archivedAt?.toISOString() ??
          null,
        serviceId: primaryBooking?.serviceId ?? (job as any).serviceId ?? null,
        service: primaryBooking?.service ?? (job as any).service ?? null,
        startTime: primaryBooking?.startTime?.toISOString() ?? null,
        endTime: primaryBooking?.endTime?.toISOString() ?? null,
        toBeScheduled: primaryBooking ? (primaryBooking.toBeScheduled ?? false) : true,
        status: primaryBooking?.status ?? job.status,
        price:
          primaryBooking?.price != null
            ? Number(primaryBooking.price)
            : (job as any).price != null
              ? Number((job as any).price)
              : null,
        timeEntries: job.timeEntries.map((te: any) => ({
          ...te,
          startTime: te.startTime.toISOString(),
          endTime: te.endTime.toISOString(),
          userId: te.userId ?? undefined,
          userName: te.user?.name ?? undefined,
          hourlyRate: visibleHourlyRate(te, currentUserRole, currentUserId),
        })),
      }
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)

      const toBeScheduled = payload.toBeScheduled === true

      await validateAssignedTo(tenantId, payload.assignedTo)

      // Validate: recurrence requires scheduled times — EXCEPT staged monthly, which is a
      // rolling placeholder with no fixed day (frequency 'monthly' + toBeScheduled).
      if (payload.recurrence && toBeScheduled && payload.recurrence.frequency !== 'monthly') {
        throw new ApiError('Recurring jobs must have scheduled times', 400)
      }

      // Normalize assignedTo to array format
      const normalizedAssignedTo = normalizeAssignedTo(payload.assignedTo)

      // Staged monthly: create Job + JobRecurrence + ONE pending placeholder Booking.
      // (A real Booking row is required — bookingless jobs don't survive a plain calendar
      // refetch, but toBeScheduled bookings are always returned by getAll's OR-clause.)
      if (toBeScheduled && payload.recurrence) {
        const now = new Date()
        // JobRecurrence.assignedTo is String? — mirror createRecurringJobs (first string only).
        const assignedToForRecurrence = normalizedAssignedTo?.[0]?.userId ?? null
        const staged = await prisma.$transaction(async tx => {
          const job = await tx.job.create({
            data: {
              tenantId,
              title: payload.title,
              description: payload.description,
              contactId: payload.contactId,
              serviceId: payload.serviceId ?? null,
              quoteId: payload.quoteId,
              invoiceId: payload.invoiceId,
              status: 'active',
              location: payload.location,
              price: payload.price !== undefined ? payload.price : null,
              notes: payload.notes,
              assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
              createdById: payload.createdById ?? undefined,
            },
            include: { contact: true, createdBy: { select: { name: true } }, service: true },
          })
          const recurrence = await tx.jobRecurrence.create({
            data: {
              tenantId,
              contactId: payload.contactId,
              serviceId: payload.serviceId ?? null,
              title: payload.title,
              description: payload.description,
              location: payload.location,
              notes: payload.notes,
              assignedTo: assignedToForRecurrence,
              status: 'staged',
              frequency: 'monthly',
              interval: payload.recurrence.interval || 1,
              count: null,
              untilDate: null,
              daysOfWeek: [],
              // startTime/endTime are NOT NULL but unused for staged series — the startTime
              // month IS the series START month (used to gate which months show a chip).
              startTime: now,
              endTime: now,
            },
          })
          const booking = await tx.booking.create({
            data: {
              tenantId,
              jobId: job.id,
              serviceId: payload.serviceId ?? null,
              quoteId: payload.quoteId,
              invoiceId: payload.invoiceId,
              recurrenceId: recurrence.id,
              startTime: null,
              endTime: null,
              toBeScheduled: true,
              status: 'active',
              location: payload.location,
              price: payload.price !== undefined ? payload.price : null,
              notes: payload.notes,
              assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
              createdById: payload.createdById ?? undefined,
            },
            include: { service: true },
          })
          return { job, recurrence, booking }
        })
        if (normalizedAssignedTo && normalizedAssignedTo.length > 0) {
          const jobWithContact = staged.job as {
            contact?: { firstName?: string; lastName?: string }
          }
          await sendAssignmentNotification({
            tenantId,
            assignedTo: normalizedAssignedTo,
            assignerUserId: payload.createdById,
            jobTitle: staged.job.title,
            startTime: null,
            endTime: null,
            location: staged.job.location,
            contactName: jobWithContact.contact
              ? `${jobWithContact.contact.firstName ?? ''} ${jobWithContact.contact.lastName ?? ''}`.trim() ||
                undefined
              : undefined,
          }).catch(e => console.error('Failed to send assignment notification:', e))
        }
        const assignedToName = await getAssignedToName(tenantId, staged.job.assignedTo)
        return {
          ...staged.job,
          bookingId: staged.booking.id,
          recurrenceId: staged.recurrence.id,
          startTime: null,
          endTime: null,
          toBeScheduled: true,
          status: staged.job.status,
          serviceName: staged.job.service?.name ?? null,
          price: staged.booking.price != null ? Number(staged.booking.price) : null,
          assignedToName,
          isStagedSeries: true,
          seriesStartMonth: `${staged.recurrence.startTime.getUTCFullYear()}-${String(
            staged.recurrence.startTime.getUTCMonth() + 1
          ).padStart(2, '0')}`,
        }
      }

      // If toBeScheduled, create the Job AND a to-be-scheduled placeholder Booking. The Booking
      // (null times, toBeScheduled: true) is required so the job survives a plain calendar
      // refetch — getAll is booking-centric and its OR-clause always returns toBeScheduled
      // bookings, whereas a bookingless job would only show once from the optimistic client add
      // and then vanish on the next fetch.
      if (toBeScheduled) {
        const initialStatus = payload.status || 'active'
        const { job, booking } = await prisma.$transaction(async tx => {
          const job = await tx.job.create({
            data: {
              tenantId,
              title: payload.title,
              description: payload.description,
              contactId: payload.contactId,
              serviceId: payload.serviceId ?? null,
              quoteId: payload.quoteId,
              invoiceId: payload.invoiceId,
              status: initialStatus,
              location: payload.location,
              price: payload.price !== undefined ? payload.price : null,
              notes: payload.notes,
              assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
              createdById: payload.createdById ?? undefined,
            },
            include: { contact: true, createdBy: { select: { name: true } }, service: true },
          })
          const booking = await tx.booking.create({
            data: {
              tenantId,
              jobId: job.id,
              serviceId: payload.serviceId ?? null,
              quoteId: payload.quoteId,
              invoiceId: payload.invoiceId,
              startTime: null,
              endTime: null,
              toBeScheduled: true,
              status: initialStatus,
              location: payload.location,
              price: payload.price !== undefined ? payload.price : null,
              notes: payload.notes,
              assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
              createdById: payload.createdById ?? undefined,
            },
            include: { service: true },
          })
          return { job, booking }
        })
        if (normalizedAssignedTo && normalizedAssignedTo.length > 0) {
          const jobWithContact = job as { contact?: { firstName?: string; lastName?: string } }
          await sendAssignmentNotification({
            tenantId,
            assignedTo: normalizedAssignedTo,
            assignerUserId: payload.createdById,
            jobTitle: job.title,
            startTime: null,
            endTime: null,
            location: job.location,
            contactName: jobWithContact.contact
              ? `${jobWithContact.contact.firstName ?? ''} ${jobWithContact.contact.lastName ?? ''}`.trim() ||
                undefined
              : undefined,
          }).catch(e => console.error('Failed to send assignment notification:', e))
        }
        const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
        return {
          ...job,
          // Booking-like fields (backward compat for UI)
          bookingId: booking.id,
          startTime: null,
          endTime: null,
          toBeScheduled: true,
          status: booking.status,
          serviceName: (booking as any).service?.name ?? (job as any).service?.name ?? null,
          price: booking.price != null ? Number(booking.price) : null,
          assignedToName,
        }
      }

      // Otherwise, require times
      if (!payload.startTime || !payload.endTime) {
        throw new ApiError('startTime and endTime are required for scheduled jobs', 400)
      }

      const startTime = parseValidDate(payload.startTime)
      const endTime = parseValidDate(payload.endTime)

      if (!startTime || !endTime) {
        throw new ApiError(
          'Invalid startTime or endTime format. Please provide valid date strings.',
          400
        )
      }

      const forceBooking = payload.forceBooking === true

      // If recurrence is provided, use the recurring jobs logic
      if (payload.recurrence) {
        const recurringResult = await createRecurringJobs({
          tenantId,
          title: payload.title,
          description: payload.description,
          contactId: payload.contactId,
          serviceId: payload.serviceId,
          quoteId: payload.quoteId,
          invoiceId: payload.invoiceId,
          startTime,
          endTime,
          status: payload.status || 'active',
          location: payload.location,
          price: payload.price,
          notes: payload.notes,
          assignedTo: normalizedAssignedTo,
          breaks: payload.breaks,
          recurrence: payload.recurrence,
          forceBooking,
          createdById: payload.createdById ?? undefined,
        })
        if (recurringResult.assignedTo) {
          const recWithContact = recurringResult as {
            contact?: { firstName?: string; lastName?: string }
          }
          await sendAssignmentNotification({
            tenantId,
            assignedTo: recurringResult.assignedTo,
            assignerUserId: payload.createdById,
            jobTitle: recurringResult.title,
            startTime: recurringResult.startTime,
            endTime: recurringResult.endTime,
            location: recurringResult.location,
            contactName: recWithContact.contact
              ? `${recWithContact.contact.firstName ?? ''} ${recWithContact.contact.lastName ?? ''}`.trim() ||
                undefined
              : undefined,
          }).catch(e => console.error('Failed to send assignment notification:', e))
        }
        return recurringResult
      }

      // Double booking check removed - allowing overlapping jobs

      const job = await prisma.job.create({
        data: {
          tenantId,
          title: payload.title,
          description: payload.description,
          contactId: payload.contactId,
          serviceId: payload.serviceId ?? null,
          quoteId: payload.quoteId,
          invoiceId: payload.invoiceId,
          status: 'active',
          location: payload.location,
          price: payload.price !== undefined ? payload.price : null,
          notes: payload.notes,
          assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
          createdById: payload.createdById ?? undefined,
        },
        include: { contact: true, createdBy: { select: { name: true } }, service: true },
      })
      const booking = await prisma.booking.create({
        data: {
          tenantId,
          jobId: job.id,
          serviceId: payload.serviceId,
          quoteId: payload.quoteId,
          invoiceId: payload.invoiceId,
          startTime,
          endTime,
          toBeScheduled: false,
          status: payload.status || 'active',
          location: payload.location,
          price: payload.price !== undefined ? payload.price : null,
          notes: payload.notes,
          assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
          breaks: payload.breaks || null,
          createdById: payload.createdById ?? undefined,
        },
        include: { service: true },
      })
      const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
      if (job.assignedTo && Array.isArray(job.assignedTo)) {
        const jobWithContact = job as { contact?: { firstName?: string; lastName?: string } }
        await sendAssignmentNotification({
          tenantId,
          assignedTo: job.assignedTo as any,
          assignerUserId: payload.createdById,
          jobTitle: job.title,
          startTime: booking.startTime,
          endTime: booking.endTime,
          location: job.location,
          contactName: jobWithContact.contact
            ? `${jobWithContact.contact.firstName ?? ''} ${jobWithContact.contact.lastName ?? ''}`.trim() ||
              undefined
            : undefined,
        }).catch(e => console.error('Failed to send assignment notification:', e))
      }

      // Client notification: when notifyClient is true on manual create
      if (payload.notifyClient === true && job.contact) {
        try {
          const contact = job.contact as
            | (Contact & { notificationPreference?: string; email?: string; phone?: string })
            | null
          const pref = contact?.notificationPreference ?? 'both'
          const wantsEmail = shouldSendEmail(pref) && contact?.email?.trim()
          const wantsSms = shouldSendSms(pref) && contact?.phone?.trim()
          if (wantsEmail || wantsSms) {
            const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } })
            let logoUrl: string | null = null
            if (settings?.logoUrl) {
              try {
                const { getFileUrl } = await import('./fileUpload')
                logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
              } catch (e) {
                console.error('Error fetching logo URL for confirmation email:', e)
              }
            }
            const companyName = settings?.companyDisplayName || 'JobDock'
            // Render times in the tenant's timezone, DST-correct at the APPOINTMENT instant (not
            // "now" — a booking made in PST for a PDT appointment must show the PDT time).
            const timezoneOffset = offsetHoursForZone(settings?.timezone, new Date(startTime!))
            const serviceName = (booking as any)?.service?.name || job.title || 'Appointment'
            const clientName = contact
              ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'there'
              : 'there'
            const rescheduleToken = generateApprovalToken('job', job.id, tenantId)
            let smsRescheduleUrl: string | undefined
            if (wantsSms) {
              try {
                const { createShortLink } = await import('./shortLinks')
                const publicAppUrl = (
                  process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
                ).replace(/\/$/, '')
                const rescheduleFullUrl = `${publicAppUrl}/public/booking/${job.id}/reschedule?token=${rescheduleToken}`
                smsRescheduleUrl = await createShortLink(rescheduleFullUrl)
              } catch (e) {
                console.warn('Could not create short link for confirmation SMS:', e)
              }
            }
            if (wantsEmail) {
              console.log(`📧 Sending manual booking confirmation email to ${contact!.email}`)
              const emailPayload = buildClientConfirmationEmail({
                clientName,
                serviceName,
                startTime: startTime!,
                endTime: endTime!,
                location: job.location ?? undefined,
                timezoneOffset,
                companyName,
                logoUrl,
                settings: {
                  companySupportEmail: settings?.companySupportEmail || null,
                  companyPhone: settings?.companyPhone || null,
                },
                jobId: job.id,
                rescheduleToken,
              })
              await sendEmail({
                ...emailPayload,
                to: contact!.email!,
                fromName: companyName,
                replyTo: settings?.companySupportEmail || undefined,
              })
              console.log('✅ Manual booking confirmation email sent successfully')
            }
            if (wantsSms) {
              console.log(`📱 Sending manual booking confirmation SMS to ${contact!.phone}`)
              const smsBody = buildBookingConfirmationSms({
                serviceName,
                startTime: startTime!,
                companyName,
                timezoneOffset,
                rescheduleUrl: smsRescheduleUrl,
              })
              await sendSms(contact!.phone!, smsBody)
              console.log('✅ Manual booking confirmation SMS sent successfully')
            }
          }
        } catch (clientNotifyError) {
          console.error(
            '❌ Failed to send client notification for manual booking:',
            clientNotifyError
          )
        }
      }

      return {
        ...job,
        ...booking,
        // Restore job identity after the booking spread: the booking's `id`,
        // `title` and `contactId` (null for job-backed bookings) would clobber
        // the job's, so the frontend edits PUT /jobs/{bookingId} and 404s.
        // Matches the flattened shape jobs.getAll returns.
        id: job.id,
        title: job.title,
        contactId: job.contactId,
        bookingId: booking.id,
        serviceId: booking.serviceId,
        service: booking.service,
        startTime: booking.startTime?.toISOString(),
        endTime: booking.endTime?.toISOString(),
        toBeScheduled: false,
        status: booking.status,
        price: booking.price != null ? Number(booking.price) : null,
        assignedToName,
      }
    },
    update: async (tenantId: string, id: string, payload: any) => {
      const existingJob = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })
      if (!existingJob) throw new ApiError('Job not found', 404)

      const primaryBooking = existingJob.bookings[0]
      const jobUpdateData: any = {}
      if (payload.title !== undefined) jobUpdateData.title = payload.title
      if (payload.description !== undefined) jobUpdateData.description = payload.description
      if (payload.contactId !== undefined) jobUpdateData.contactId = payload.contactId
      if (payload.quoteId !== undefined) jobUpdateData.quoteId = payload.quoteId
      if (payload.invoiceId !== undefined) jobUpdateData.invoiceId = payload.invoiceId
      if (payload.status !== undefined) jobUpdateData.status = payload.status
      if (payload.location !== undefined) jobUpdateData.location = payload.location
      if (payload.notes !== undefined) jobUpdateData.notes = payload.notes
      if (payload.assignedTo !== undefined)
        jobUpdateData.assignedTo = (normalizeAssignedTo(payload.assignedTo) ??
          null) as unknown as Prisma.InputJsonValue

      const bookingUpdateData: any = {}
      if (payload.serviceId !== undefined) {
        bookingUpdateData.serviceId = payload.serviceId
        jobUpdateData.serviceId = payload.serviceId ?? null
      }
      if (payload.price !== undefined) {
        // Normalize price: convert to number or null
        if (payload.price === null || payload.price === '') {
          bookingUpdateData.price = null
          jobUpdateData.price = null
        } else {
          const numPrice =
            typeof payload.price === 'number' ? payload.price : parseFloat(payload.price)
          bookingUpdateData.price = isNaN(numPrice) ? null : numPrice
          jobUpdateData.price = isNaN(numPrice) ? null : numPrice
        }
      }
      if (payload.breaks !== undefined) bookingUpdateData.breaks = payload.breaks
      if (payload.startTime !== undefined) {
        const parsed = parseValidDate(payload.startTime)
        if (!parsed) throw new ApiError('Invalid startTime format', 400)
        bookingUpdateData.startTime = parsed
      }
      if (payload.endTime !== undefined) {
        const parsed = parseValidDate(payload.endTime)
        if (!parsed) throw new ApiError('Invalid endTime format', 400)
        bookingUpdateData.endTime = parsed
      }
      if (payload.toBeScheduled !== undefined) {
        bookingUpdateData.toBeScheduled = payload.toBeScheduled
        if (payload.toBeScheduled) {
          bookingUpdateData.startTime = null
          bookingUpdateData.endTime = null
        }
      }
      if (payload.status !== undefined) bookingUpdateData.status = payload.status

      await validateAssignedTo(tenantId, jobUpdateData.assignedTo ?? payload.assignedTo)

      // Stop the series: the form/detail sends `removeRecurrence` to halt a staged monthly
      // series. Soft-archive the anchor placeholder booking(s) AND mark the JobRecurrence
      // archived so no future virtual chips appear. Already-scheduled real occurrences and the
      // Job itself are left untouched — a stopped series keeps its past/scheduled appointments.
      if (payload.removeRecurrence === true) {
        const now = new Date()
        const stagedRecurrenceIds = Array.from(
          new Set(
            existingJob.bookings
              .filter(b => b.toBeScheduled === true && b.recurrenceId)
              .map(b => b.recurrenceId as string)
          )
        )
        if (stagedRecurrenceIds.length > 0) {
          await prisma.booking.updateMany({
            where: {
              tenantId,
              recurrenceId: { in: stagedRecurrenceIds },
              toBeScheduled: true,
              archivedAt: null,
            },
            data: { archivedAt: now },
          })
          await prisma.jobRecurrence.updateMany({
            where: { tenantId, id: { in: stagedRecurrenceIds } },
            data: { status: 'archived' },
          })
        }
        if (Object.keys(jobUpdateData).length > 0) {
          await prisma.job.update({ where: { id }, data: jobUpdateData })
        }
        const afterOff = await prisma.job.findFirst({
          where: { id },
          include: {
            contact: true,
            bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
          },
        })
        const remaining = afterOff!.bookings.find(x => x.archivedAt == null) ?? null
        const assignedToName = await getAssignedToName(tenantId, afterOff!.assignedTo)
        return {
          ...afterOff,
          bookingId: remaining?.id ?? null,
          serviceId: remaining?.serviceId,
          service: remaining?.service,
          startTime: remaining?.startTime?.toISOString() ?? null,
          endTime: remaining?.endTime?.toISOString() ?? null,
          toBeScheduled: remaining?.toBeScheduled ?? false,
          status: remaining?.status ?? afterOff!.status,
          price: remaining?.price != null ? Number(remaining.price) : null,
          assignedToName,
        }
      }

      // Schedule a staged occurrence: a virtual per-month chip was dropped onto the calendar.
      // Create a NEW scheduled Booking for the series WITHOUT touching the anchor placeholder
      // (so the series keeps producing chips for other months). No rolling — one occurrence.
      if (payload.scheduleStagedOccurrence === true) {
        const start = parseValidDate(payload.startTime)
        const end = parseValidDate(payload.endTime)
        if (!start || !end) {
          throw new ApiError('startTime and endTime are required to schedule an occurrence', 400)
        }
        const anchor = existingJob.bookings.find(b => b.toBeScheduled === true && b.recurrenceId)
        const recurrenceId = payload.recurrenceId ?? anchor?.recurrenceId ?? null
        const occServiceId = payload.serviceId ?? anchor?.serviceId ?? existingJob.serviceId ?? null
        const created = await prisma.booking.create({
          data: {
            tenantId,
            jobId: id,
            recurrenceId,
            serviceId: occServiceId,
            quoteId: anchor?.quoteId ?? existingJob.quoteId ?? undefined,
            invoiceId: anchor?.invoiceId ?? existingJob.invoiceId ?? undefined,
            startTime: start,
            endTime: end,
            toBeScheduled: false,
            status: payload.status ?? 'active',
            location: payload.location ?? anchor?.location ?? existingJob.location ?? null,
            price:
              payload.price != null
                ? Number(payload.price)
                : anchor?.price != null
                  ? anchor.price
                  : existingJob.price ?? null,
            notes: payload.notes ?? anchor?.notes ?? existingJob.notes ?? null,
            assignedTo: (anchor?.assignedTo ??
              existingJob.assignedTo ??
              undefined) as unknown as Prisma.InputJsonValue,
            createdById: existingJob.createdById ?? payload.createdById ?? undefined,
          },
          include: { service: true },
        })
        const assignedToName = await getAssignedToName(tenantId, existingJob.assignedTo)
        return {
          ...existingJob,
          bookingId: created.id,
          recurrenceId,
          serviceId: created.serviceId,
          service: created.service,
          startTime: created.startTime?.toISOString() ?? null,
          endTime: created.endTime?.toISOString() ?? null,
          toBeScheduled: false,
          status: created.status,
          price: created.price != null ? Number(created.price) : null,
          assignedToName,
        }
      }

      // Turn staging ON (upgrade): an existing unscheduled job becomes a staged monthly
      // series. No fixed times — create the JobRecurrence and attach ONE anchor placeholder.
      const isStagedMonthlyUpgrade =
        payload.recurrence &&
        payload.recurrence.frequency === 'monthly' &&
        payload.toBeScheduled === true &&
        !existingJob.bookings.some(b => b.recurrenceId)
      if (isStagedMonthlyUpgrade) {
        const now = new Date()
        const assignedArr = normalizeAssignedTo(jobUpdateData.assignedTo ?? existingJob.assignedTo)
        const assignedToForRecurrence = assignedArr?.[0]?.userId ?? null
        const recurrenceServiceId = bookingUpdateData.serviceId ?? existingJob.serviceId ?? null
        const recurrence = await prisma.jobRecurrence.create({
          data: {
            tenantId,
            contactId: jobUpdateData.contactId ?? existingJob.contactId,
            serviceId: recurrenceServiceId,
            title: jobUpdateData.title ?? existingJob.title,
            description: jobUpdateData.description ?? existingJob.description ?? null,
            location: jobUpdateData.location ?? existingJob.location ?? null,
            notes: jobUpdateData.notes ?? existingJob.notes ?? null,
            assignedTo: assignedToForRecurrence,
            status: 'staged',
            frequency: 'monthly',
            interval: payload.recurrence.interval || 1,
            count: null,
            untilDate: null,
            daysOfWeek: [],
            startTime: now,
            endTime: now,
          },
        })
        // Reuse an existing unscheduled booking if the job already had one; else create.
        const existingPlaceholder = existingJob.bookings.find(
          b => b.toBeScheduled === true && !b.recurrenceId
        )
        if (existingPlaceholder) {
          await prisma.booking.update({
            where: { id: existingPlaceholder.id },
            data: {
              recurrenceId: recurrence.id,
              toBeScheduled: true,
              startTime: null,
              endTime: null,
            },
          })
        } else {
          await prisma.booking.create({
            data: {
              tenantId,
              jobId: id,
              serviceId: recurrenceServiceId,
              recurrenceId: recurrence.id,
              startTime: null,
              endTime: null,
              toBeScheduled: true,
              status: 'active',
              location: jobUpdateData.location ?? existingJob.location ?? null,
              price:
                bookingUpdateData.price != null
                  ? bookingUpdateData.price
                  : existingJob.price ?? null,
              notes: jobUpdateData.notes ?? existingJob.notes ?? null,
              assignedTo: (assignedArr ?? undefined) as unknown as Prisma.InputJsonValue,
              createdById: existingJob.createdById ?? payload.createdById ?? undefined,
            },
          })
        }
        if (Object.keys(jobUpdateData).length > 0) {
          await prisma.job.update({ where: { id }, data: jobUpdateData })
        }
        const upgraded = await prisma.job.findFirst({
          where: { id },
          include: {
            contact: true,
            bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
          },
        })
        const placeholder = upgraded!.bookings.find(
          b => b.toBeScheduled && b.recurrenceId === recurrence.id
        )
        const assignedToName = await getAssignedToName(tenantId, upgraded!.assignedTo)
        return {
          ...upgraded,
          bookingId: placeholder?.id ?? null,
          recurrenceId: recurrence.id,
          serviceId: placeholder?.serviceId ?? null,
          service: placeholder?.service ?? null,
          startTime: null,
          endTime: null,
          toBeScheduled: true,
          status: upgraded!.status,
          price: placeholder?.price != null ? Number(placeholder.price) : null,
          assignedToName,
          isStagedSeries: true,
          seriesStartMonth: `${recurrence.startTime.getUTCFullYear()}-${String(
            recurrence.startTime.getUTCMonth() + 1
          ).padStart(2, '0')}`,
        }
      }

      // Recurrence: if adding recurrence, use createRecurringJobs (simplified - would need primary booking times)
      if (payload.recurrence && !primaryBooking?.recurrenceId) {
        const finalStart = bookingUpdateData.startTime || primaryBooking?.startTime
        const finalEnd = bookingUpdateData.endTime || primaryBooking?.endTime
        if (!finalStart || !finalEnd)
          throw new ApiError('Job must have start and end times to add recurrence', 400)
        const recurringResult = await createRecurringJobs({
          tenantId,
          title: jobUpdateData.title || existingJob.title,
          description: jobUpdateData.description ?? existingJob.description ?? undefined,
          contactId: jobUpdateData.contactId || existingJob.contactId,
          serviceId: bookingUpdateData.serviceId ?? primaryBooking?.serviceId ?? undefined,
          quoteId: jobUpdateData.quoteId ?? existingJob.quoteId ?? undefined,
          invoiceId: jobUpdateData.invoiceId ?? existingJob.invoiceId ?? undefined,
          startTime: new Date(finalStart),
          endTime: new Date(finalEnd),
          status: bookingUpdateData.status ?? primaryBooking?.status ?? 'active',
          location: jobUpdateData.location ?? existingJob.location ?? undefined,
          price:
            bookingUpdateData.price != null
              ? bookingUpdateData.price
              : primaryBooking?.price != null
                ? Number(primaryBooking.price)
                : null,
          notes: jobUpdateData.notes ?? existingJob.notes ?? undefined,
          assignedTo: jobUpdateData.assignedTo ?? existingJob.assignedTo ?? undefined,
          breaks: bookingUpdateData.breaks ?? (primaryBooking?.breaks as any) ?? undefined,
          recurrence: payload.recurrence,
          // Reuse the existing Job row (replacing only its bookings) so time
          // entries, photos, and job-log history survive the conversion.
          existingJobId: id,
          createdById: (existingJob as any).createdById ?? payload.createdById,
        })
        return recurringResult
      }

      // Update all future bookings in recurrence
      if (payload.updateAll && primaryBooking?.recurrenceId) {
        // Use the edited occurrence (payload.bookingId) for time delta - not primaryBooking.
        // When user edits a later occurrence, primaryBooking is the first; using it would
        // compute wrong timeDelta and collapse all dates to the same day when timeDelta was 0.
        const editedBooking = payload.bookingId
          ? existingJob.bookings.find((b: { id: string }) => b.id === payload.bookingId)
          : primaryBooking
        const baseBooking = editedBooking ?? primaryBooking

        const futureBookings = await prisma.booking.findMany({
          where: {
            recurrenceId: primaryBooking.recurrenceId,
            tenantId,
            // Deleted/archived occurrences are history — never rewrite them (a later restore
            // must bring back the appointment as it was when it was deleted).
            archivedAt: null,
            deletedAt: null,
            ...(baseBooking?.startTime ? { startTime: { gte: baseBooking.startTime } } : {}),
          },
          orderBy: { startTime: 'asc' },
        })

        // Preserve local wall-clock time across DST when shifting the series. A raw ms delta moves
        // the UTC instant uniformly, so a change spanning a DST boundary (editing across spring-
        // forward, or a +1 day shift landing on a fall-back day) drifts every later occurrence by
        // an hour. Computing the delta in the recurrence timezone's wall-clock frame keeps "9am" at
        // 9am. Recurrences without a stored timezone keep the legacy ms behavior.
        const recurrence = await prisma.jobRecurrence.findUnique({
          where: { id: primaryBooking.recurrenceId },
          select: { timezone: true },
        })
        const recurrenceTz = recurrence?.timezone || undefined

        const timeDelta =
          payload.startTime !== undefined && baseBooking?.startTime
            ? new Date(payload.startTime).getTime() - new Date(baseBooking.startTime).getTime()
            : 0
        // Wall-clock delta: the edited occurrence's new vs old LOCAL time (each day treated as its
        // nominal length), used when a timezone is known.
        const localDelta =
          recurrenceTz && payload.startTime !== undefined && baseBooking?.startTime
            ? toZonedTime(new Date(payload.startTime), recurrenceTz).getTime() -
              toZonedTime(new Date(baseBooking.startTime), recurrenceTz).getTime()
            : null
        const newDurationMs =
          payload.startTime !== undefined && payload.endTime !== undefined
            ? new Date(payload.endTime).getTime() - new Date(payload.startTime).getTime()
            : null

        for (const b of futureBookings) {
          const data: any = { ...bookingUpdateData }
          if (b.startTime && b.endTime) {
            const newStart =
              localDelta != null && recurrenceTz
                ? fromZonedTime(
                    new Date(
                      toZonedTime(new Date(b.startTime), recurrenceTz).getTime() + localDelta
                    ),
                    recurrenceTz
                  )
                : new Date(new Date(b.startTime).getTime() + timeDelta)
            data.startTime = newStart
            const durationMs =
              newDurationMs != null
                ? newDurationMs
                : new Date(b.endTime).getTime() - new Date(b.startTime).getTime()
            data.endTime = new Date(newStart.getTime() + durationMs)
          }
          if (Object.keys(data).length > 0) {
            await prisma.booking.update({ where: { id: b.id }, data })
          }
        }
      } else if (payload.bookingId && Object.keys(bookingUpdateData).length > 0) {
        // Update a specific booking (e.g. when dragging a to-be-scheduled onto the calendar)
        const targetBooking = existingJob.bookings.find((b: any) => b.id === payload.bookingId)
        if (targetBooking) {
          await prisma.booking.update({ where: { id: payload.bookingId }, data: bookingUpdateData })
        }
      } else if (primaryBooking) {
        // Check if we're scheduling a new appointment (has startTime/endTime and toBeScheduled is not explicitly true)
        const hasNewScheduledTimes =
          bookingUpdateData.startTime !== undefined &&
          bookingUpdateData.endTime !== undefined &&
          bookingUpdateData.startTime !== null &&
          bookingUpdateData.endTime !== null &&
          bookingUpdateData.toBeScheduled !== true

        // Check if there are already scheduled bookings (not toBeScheduled)
        const scheduledBookings = existingJob.bookings.filter(
          (b: any) => b.toBeScheduled === false && b.startTime !== null && b.endTime !== null
        )
        const hasScheduledBookings = scheduledBookings.length > 0

        // Check if the new times match an existing scheduled booking (editing vs creating)
        const matchesExistingBooking =
          hasNewScheduledTimes &&
          scheduledBookings.some((b: any) => {
            const existingStart = b.startTime ? new Date(b.startTime).getTime() : null
            const existingEnd = b.endTime ? new Date(b.endTime).getTime() : null
            const newStart = bookingUpdateData.startTime
              ? new Date(bookingUpdateData.startTime).getTime()
              : null
            const newEnd = bookingUpdateData.endTime
              ? new Date(bookingUpdateData.endTime).getTime()
              : null
            return existingStart === newStart && existingEnd === newEnd
          })

        // When converting a scheduled job to to-be-scheduled: UPDATE the existing booking (don't create a duplicate).
        // Only create new when adding scheduled times that don't match an existing booking.
        if (hasNewScheduledTimes && hasScheduledBookings && !matchesExistingBooking) {
          // Create a new scheduled booking instead of updating the existing one
          await prisma.booking.create({
            data: {
              tenantId,
              jobId: id,
              ...bookingUpdateData,
              toBeScheduled: false,
              status: bookingUpdateData.status ?? 'active',
            },
          })
        } else if (Object.keys(bookingUpdateData).length > 0) {
          // Update the primary booking (either unscheduled or editing existing scheduled)
          await prisma.booking.update({ where: { id: primaryBooking.id }, data: bookingUpdateData })
        }
      } else if (Object.keys(bookingUpdateData).length > 0) {
        // Job has no bookings - create when: (a) user schedules with times, or (b) user adds to-be-scheduled (link to existing job)
        const hasScheduledTimes =
          bookingUpdateData.startTime != null &&
          bookingUpdateData.endTime != null &&
          bookingUpdateData.toBeScheduled !== true
        const isAddingToBeScheduledPlaceholder =
          bookingUpdateData.toBeScheduled === true &&
          (bookingUpdateData.startTime == null || bookingUpdateData.endTime == null)
        if (hasScheduledTimes || isAddingToBeScheduledPlaceholder) {
          await prisma.booking.create({
            data: {
              tenantId,
              jobId: id,
              ...bookingUpdateData,
              toBeScheduled: isAddingToBeScheduledPlaceholder,
              startTime: isAddingToBeScheduledPlaceholder ? null : bookingUpdateData.startTime,
              endTime: isAddingToBeScheduledPlaceholder ? null : bookingUpdateData.endTime,
              status: bookingUpdateData.status ?? 'active',
            },
          })
        }
      }

      // Effective-date pay change: update time entries before updating job
      const effectiveDate = payload.effectiveDate ?? payload.payChangeEffectiveDate
      if (
        effectiveDate &&
        jobUpdateData.assignedTo &&
        JSON.stringify(jobUpdateData.assignedTo) !== JSON.stringify(existingJob.assignedTo)
      ) {
        await applyPayChangeEffectiveDate(
          tenantId,
          id,
          existingJob.assignedTo,
          jobUpdateData.assignedTo as JobAssignment[],
          effectiveDate
        )
      }

      if (Object.keys(jobUpdateData).length > 0) {
        await prisma.job.update({ where: { id }, data: jobUpdateData })
      }

      const updated = await prisma.job.findFirst({
        where: { id },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })
      // When we updated a specific booking, use that for the flattened response
      const b = payload.bookingId
        ? (updated!.bookings.find((x: any) => x.id === payload.bookingId) ?? updated!.bookings[0])
        : updated!.bookings[0]
      const assignedToName = await getAssignedToName(tenantId, updated!.assignedTo)
      if (
        jobUpdateData.assignedTo &&
        JSON.stringify(jobUpdateData.assignedTo) !== JSON.stringify(existingJob.assignedTo)
      ) {
        // Only notify newly added members
        const oldUserIds = new Set(extractUserIds(existingJob.assignedTo))
        const newUserIds = extractUserIds(jobUpdateData.assignedTo)
        const newlyAddedUserIds = newUserIds.filter(id => !oldUserIds.has(id))

        if (newlyAddedUserIds.length > 0) {
          await sendAssignmentNotification({
            tenantId,
            assignedTo: jobUpdateData.assignedTo,
            assignerUserId: payload._actingUserId,
            jobTitle: updated!.title,
            startTime: b?.startTime ?? null,
            endTime: b?.endTime ?? null,
            location: updated!.location,
            contactName: updated!.contact
              ? `${updated!.contact.firstName ?? ''} ${updated!.contact.lastName ?? ''}`.trim() ||
                undefined
              : undefined,
            userIdsToNotify: newlyAddedUserIds,
          }).catch(e => console.error('Failed to send assignment notification:', e))
        }
      }

      // Reschedule notification: when notifyClient is true and date/time changed
      const timesChanged = payload.startTime !== undefined || payload.endTime !== undefined
      if (payload.notifyClient === true && timesChanged && b?.startTime && b?.endTime) {
        try {
          const contact = updated!.contact as (Contact & { notificationPreference?: string }) | null
          // No contact (e.g. online booking): send both. With contact: use notificationPreference.
          const pref = contact?.notificationPreference ?? 'both'
          const wantsEmail = shouldSendEmail(pref)
          const wantsSms = shouldSendSms(pref)
          const clientEmail = contact?.email?.trim() || null
          const clientPhone = contact?.phone?.trim() || null

          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })
          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              const { getFileUrl } = await import('./fileUpload')
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
            } catch (error) {
              console.error('Error fetching logo URL for reschedule email:', error)
            }
          }
          const companyName = settings?.companyDisplayName || 'JobDock'
          const timezoneOffset = offsetHoursForZone(
            settings?.timezone,
            b.startTime ? new Date(b.startTime) : new Date()
          )
          const serviceName = (b as any)?.service?.name || updated!.title || 'Appointment'

          if (wantsEmail && clientEmail) {
            console.log(`📧 Sending reschedule email to ${clientEmail}`)
            const clientName = contact
              ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'there'
              : 'there'
            const emailPayload = buildClientRescheduleEmail({
              clientName,
              serviceName,
              startTime: new Date(b.startTime),
              endTime: new Date(b.endTime),
              location: updated!.location ?? undefined,
              timezoneOffset,
              companyName,
              logoUrl,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
            })
            await sendEmail({
              ...emailPayload,
              to: clientEmail,
              fromName: companyName,
              replyTo: settings?.companySupportEmail || undefined,
            })
            console.log('✅ Reschedule email sent successfully')
          }
          if (wantsSms && clientPhone) {
            console.log(`📱 Sending reschedule SMS to ${clientPhone}`)
            const smsBody = buildRescheduleNotificationSms({
              serviceName,
              startTime: new Date(b.startTime),
              companyName,
              timezoneOffset,
            })
            await sendSms(clientPhone, smsBody)
            console.log('✅ Reschedule SMS sent successfully')
          }
        } catch (rescheduleError) {
          console.error('❌ Failed to send reschedule notification:', rescheduleError)
        }
      }

      return {
        ...updated,
        bookingId: b?.id ?? null,
        serviceId: b?.serviceId,
        service: b?.service,
        startTime: b?.startTime?.toISOString() ?? null,
        endTime: b?.endTime?.toISOString() ?? null,
        toBeScheduled: b?.toBeScheduled ?? false,
        status: b?.status ?? updated!.status,
        price: b?.price != null ? Number(b.price) : null,
        assignedToName,
      }
    },
    delete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { bookings: true },
      })
      if (!job) throw new ApiError('Job not found', 404)

      const now = new Date()
      const primaryBooking = job.bookings[0]

      if (deleteAll && primaryBooking?.recurrenceId) {
        // Recurring series: archive all bookings in the series and all jobs they belong to.
        const seriesBookings = await prisma.booking.findMany({
          where: { recurrenceId: primaryBooking.recurrenceId, tenantId },
          select: { jobId: true },
        })
        const jobIds = Array.from(
          new Set(seriesBookings.map(b => b.jobId).filter((v): v is string => !!v))
        )
        // Only stamp rows that are still live. Bookings/jobs the user archived individually keep
        // their own timestamp so a later restore (matched by archivedAt) can't resurrect them —
        // the same guard bookings.delete's "Delete series" already uses.
        await prisma.booking.updateMany({
          where: { recurrenceId: primaryBooking.recurrenceId, tenantId, archivedAt: null },
          data: { archivedAt: now },
        })
        if (jobIds.length > 0) {
          await prisma.job.updateMany({
            where: { id: { in: jobIds }, tenantId, archivedAt: null },
            data: { archivedAt: now },
          })
        }
      } else {
        // Only stamp still-live bookings — see the series branch above; a booking archived
        // individually earlier keeps its own timestamp and stays archived through a job restore.
        await prisma.booking.updateMany({
          where: { jobId: id, tenantId, archivedAt: null },
          data: { archivedAt: now },
        })
        await prisma.job.update({
          where: { id },
          data: { archivedAt: now },
        })
      }
      return { success: true }
    },
    permanentDelete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { bookings: true },
      })
      if (!job) throw new ApiError('Job not found', 404)

      const primaryBooking = job.bookings[0]
      const hasArchived = !!job.archivedAt || job.bookings.some((b: any) => b.archivedAt)

      if (hasArchived) {
        try {
          const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
          const s3 = new S3Client({})
          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.FILES_BUCKET!,
              Key: `archives/jobs/${tenantId}/${id}.json`,
            })
          )
        } catch (s3Error) {
          console.error('Failed to delete job from S3:', s3Error)
        }
      }

      if (deleteAll && primaryBooking?.recurrenceId) {
        const recurringBookings = await prisma.booking.findMany({
          where: { recurrenceId: primaryBooking.recurrenceId, tenantId },
        })
        const jobIds = [...new Set(recurringBookings.map((b: any) => b.jobId))]
        for (const jid of jobIds) {
          try {
            const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
            const s3 = new S3Client({})
            await s3.send(
              new DeleteObjectCommand({
                Bucket: process.env.FILES_BUCKET!,
                Key: `archives/jobs/${tenantId}/${jid}.json`,
              })
            )
          } catch (_) {}
        }
        for (const jid of jobIds) {
          await prisma.job.delete({ where: { id: jid } })
        }
      } else {
        await prisma.job.delete({ where: { id } })
      }

      return { success: true, permanent: true }
    },
    restore: async (tenantId: string, id: string, bookingId?: string) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { bookings: true, contact: true },
      })
      if (!job) throw new ApiError('Job not found', 404)
      const hasArchived = !!job.archivedAt || job.bookings.some((b: any) => b.archivedAt)
      if (!hasArchived) throw new ApiError('Job is not archived', 400)

      // Restore = undo the delete operation that archived what the caller clicked, never
      // "un-archive everything": jobs.delete stamps the job and every booking it archives with
      // one shared timestamp, so matching archivedAt (±2s for legacy rows with split clocks)
      // identifies exactly that operation's rows. Bookings the user archived individually
      // (their own timestamps) stay archived instead of being silently resurrected.
      const recurrenceIds = Array.from(
        new Set(job.bookings.map((b: any) => b.recurrenceId).filter((v: any): v is string => !!v))
      )
      if (job.archivedAt) {
        const t = job.archivedAt.getTime()
        const stamp = { gte: new Date(t - 2000), lte: new Date(t + 2000) }
        const seriesScope: Prisma.BookingWhereInput[] = [
          { jobId: id },
          ...(recurrenceIds.length > 0 ? [{ recurrenceId: { in: recurrenceIds } }] : []),
        ]
        await prisma.booking.updateMany({
          where: {
            tenantId,
            OR: [
              { archivedAt: stamp, OR: seriesScope },
              // The specific row the caller clicked is restored regardless of when it was archived.
              ...(bookingId ? [{ id: bookingId, OR: seriesScope }] : []),
            ],
          },
          data: { archivedAt: null },
        })
        // deleteAll archives sibling jobs of a legacy multi-job series with the same stamp — undo those too.
        if (recurrenceIds.length > 0) {
          const seriesBookings = await prisma.booking.findMany({
            where: { tenantId, recurrenceId: { in: recurrenceIds } },
            select: { jobId: true },
          })
          const siblingJobIds = Array.from(
            new Set(seriesBookings.map(b => b.jobId).filter((v): v is string => !!v))
          )
          if (siblingJobIds.length > 0) {
            await prisma.job.updateMany({
              where: { id: { in: siblingJobIds }, tenantId, archivedAt: stamp },
              data: { archivedAt: null },
            })
          }
        }
        await prisma.job.update({ where: { id }, data: { archivedAt: null } })
      } else {
        // Job itself is live; only individual bookings are archived. Find the booking the caller
        // pointed at (or the most recently archived one when unspecified).
        const target = bookingId
          ? job.bookings.find((b: any) => b.id === bookingId && b.archivedAt)
          : [...job.bookings]
              .filter((b: any) => b.archivedAt)
              .sort((a: any, b: any) => b.archivedAt.getTime() - a.archivedAt.getTime())[0]
        if (!target) throw new ApiError('Booking is not archived', 400)
        if (target.recurrenceId && target.archivedAt) {
          // A calendar "Delete series" archives every booking in the recurrence with one shared
          // timestamp and leaves the job live, and the archive UI collapses them into a single
          // row — so restoring one undoes the whole operation. Bring back every sibling in the
          // same recurrence archived within ±2s of the target. An individually-deleted occurrence
          // has a unique timestamp (and live siblings have null archivedAt), so only it matches —
          // single-occurrence restores stay single.
          const t = target.archivedAt.getTime()
          await prisma.booking.updateMany({
            where: {
              tenantId,
              recurrenceId: target.recurrenceId,
              archivedAt: { gte: new Date(t - 2000), lte: new Date(t + 2000) },
            },
            data: { archivedAt: null },
          })
        } else {
          await prisma.booking.update({ where: { id: target.id }, data: { archivedAt: null } })
        }
      }

      const restored = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          bookings: {
            where: { archivedAt: null, deletedAt: null },
            orderBy: { startTime: 'asc' },
          },
          contact: true,
        },
      })
      const b = restored!.bookings[0]
      const occurrenceCount = b?.recurrenceId
        ? await prisma.booking.count({
            where: { tenantId, recurrenceId: b.recurrenceId, deletedAt: null },
          })
        : 1
      return {
        ...restored,
        bookingId: b?.id ?? null,
        recurrenceId: b?.recurrenceId ?? null,
        occurrenceCount,
        serviceId: b?.serviceId,
        service: null,
        startTime: b?.startTime?.toISOString() ?? null,
        endTime: b?.endTime?.toISOString() ?? null,
        toBeScheduled: b?.toBeScheduled ?? false,
        status: b?.status ?? restored!.status,
        price: b?.price != null ? Number(b.price) : null,
        archivedAt: null,
      }
    },
    confirm: async (tenantId: string, id: string, notifyClient?: boolean) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })

      if (!job) throw new Error('Job not found')
      const primaryBooking = job.bookings[0]
      if (primaryBooking?.status !== 'pending-confirmation') {
        throw new Error('Only pending jobs can be confirmed')
      }

      if (primaryBooking) {
        await prisma.booking.update({
          where: { id: primaryBooking.id },
          data: { status: 'active' },
        })
      }
      const updatedJob = await prisma.job.findFirst({
        where: { id },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })

      // Send confirmation to client (email and/or SMS per preference), only when the caller opts in.
      // Owner-scheduled "unconfirmed" appointments are confirmed silently unless notifyClient is set.
      if (notifyClient) {
        try {
          const b = primaryBooking ?? updatedJob!.bookings[0]
          const pref = (job.contact as any)?.notificationPreference ?? 'both'
          const wantsEmail = shouldSendEmail(pref) && job.contact.email
          const wantsSms = shouldSendSms(pref) && job.contact?.phone?.trim()

          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })
          const serviceAvailability = ((b as any)?.service?.availability as any) || {}
          const timezoneOffset =
            serviceAvailability?.timezoneOffset ??
            offsetHoursForZone(settings?.timezone, b.startTime ? new Date(b.startTime) : new Date())
          const companyName = settings?.companyDisplayName || 'JobDock'

          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              const { getFileUrl } = await import('./fileUpload')
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
            } catch (error) {
              console.error('Error fetching logo URL for email:', error)
            }
          }

          // Generate reschedule token and short link for client emails/SMS
          const rescheduleToken = generateApprovalToken('job', id, tenantId)
          let smsRescheduleUrl: string | undefined
          if (wantsSms) {
            try {
              const { createShortLink } = await import('./shortLinks')
              const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(
                /\/$/,
                ''
              )
              const rescheduleFullUrl = `${publicAppUrl}/public/booking/${id}/reschedule?token=${rescheduleToken}`
              smsRescheduleUrl = await createShortLink(rescheduleFullUrl)
            } catch (e) {
              console.warn('Could not create short link for reschedule SMS:', e)
            }
          }

          if (wantsEmail) {
            console.log(`📧 Sending confirmation email to ${job.contact.email}`)
            const emailPayload = buildClientBookingConfirmedEmail({
              clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
              serviceName: (b as any)?.service?.name || 'Service',
              startTime: b?.startTime ? new Date(b.startTime) : new Date(),
              endTime: b?.endTime ? new Date(b.endTime) : new Date(),
              location: (b?.location ?? job.location) || undefined,
              timezoneOffset,
              companyName,
              logoUrl,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
              jobId: id,
              rescheduleToken,
            })
            await sendEmail({
              ...emailPayload,
              to: job.contact!.email!,
              fromName: companyName,
              replyTo: settings?.companySupportEmail || undefined,
            })
            console.log('✅ Confirmation email sent successfully')
          }
          if (wantsSms) {
            const smsBody = buildBookingConfirmationSms({
              serviceName: (b as any)?.service?.name || 'Service',
              startTime: b?.startTime ? new Date(b.startTime) : new Date(),
              companyName,
              timezoneOffset,
              rescheduleUrl: smsRescheduleUrl,
            })
            await sendSms(job.contact!.phone!, smsBody)
          }
        } catch (emailError) {
          console.error('❌ Failed to send confirmation email:', emailError)
        }
      }

      // Return flattened job format (same as getById) so frontend receives startTime, endTime, toBeScheduled
      // and the confirmed job stays in its correct calendar slot instead of appearing in "To Be Scheduled"
      const b = updatedJob!.bookings[0]
      const assignedToName = await getAssignedToName(
        tenantId,
        b?.assignedTo ?? updatedJob!.assignedTo
      )
      const contact = updatedJob!.contact as {
        firstName?: string
        lastName?: string
        email?: string
      } | null
      return {
        ...updatedJob,
        contactName: contact
          ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
          : undefined,
        assignedToName,
        bookingId: b?.id ?? undefined,
        serviceId: b?.serviceId ?? null,
        serviceName: (b as any)?.service?.name ?? null,
        startTime: b?.startTime?.toISOString() ?? null,
        endTime: b?.endTime?.toISOString() ?? null,
        toBeScheduled: b ? (b.toBeScheduled ?? false) : false,
        status: b?.status ?? updatedJob!.status,
        price:
          b?.price != null
            ? Number(b.price)
            : (updatedJob as any).price != null
              ? Number((updatedJob as any).price)
              : null,
      }
    },
    decline: async (tenantId: string, id: string, reason?: string) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })

      if (!job) throw new Error('Job not found')
      const primaryBooking = (job as any).bookings?.[0]
      if (primaryBooking?.status !== 'pending-confirmation') {
        throw new Error('Only pending jobs can be declined')
      }

      await prisma.booking.update({
        where: { id: primaryBooking.id },
        data: { status: 'cancelled' },
      })
      if (reason) {
        await prisma.job.update({
          where: { id },
          data: { notes: `${job.notes ? job.notes + '\n' : ''}Declined: ${reason}` },
        })
      }

      const updatedJob = await prisma.job.findFirst({
        where: { id },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })

      try {
        const pref = (job.contact as any)?.notificationPreference ?? 'both'
        const wantsEmail = shouldSendEmail(pref) && job.contact?.email
        const wantsSms = shouldSendSms(pref) && job.contact?.phone?.trim()

        const settings = await prisma.tenantSettings.findUnique({
          where: { tenantId },
        })
        let logoUrl: string | null = null
        if (settings?.logoUrl) {
          try {
            const { getFileUrl } = await import('./fileUpload')
            logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
          } catch (error) {
            console.error('Error fetching logo URL for email:', error)
          }
        }
        const companyName = settings?.companyDisplayName || 'JobDock'

        if (wantsEmail) {
          console.log(`📧 Sending decline email to ${job.contact!.email}`)
          const emailPayload = buildClientBookingDeclinedEmail({
            clientName: `${job.contact!.firstName} ${job.contact!.lastName}`.trim(),
            serviceName: (primaryBooking as any)?.service?.name || 'Service',
            startTime: primaryBooking?.startTime ? new Date(primaryBooking.startTime) : new Date(),
            reason,
            companyName,
            logoUrl,
            settings: {
              companySupportEmail: settings?.companySupportEmail || null,
              companyPhone: settings?.companyPhone || null,
            },
          })
          await sendEmail({
            ...emailPayload,
            to: job.contact!.email!,
            fromName: companyName,
            replyTo: settings?.companySupportEmail || undefined,
          })
          console.log('✅ Decline email sent successfully')
        }
        if (wantsSms) {
          const smsBody = buildBookingDeclinedSms({
            serviceName: (primaryBooking as any)?.service?.name || 'Service',
            companyName,
          })
          await sendSms(job.contact!.phone!, smsBody)
        }
      } catch (emailError) {
        console.error('❌ Failed to send decline email:', emailError)
      }

      const b = (updatedJob as any)?.bookings?.[0]
      return {
        ...updatedJob,
        serviceId: b?.serviceId,
        service: (b as any)?.service,
        startTime: b?.startTime?.toISOString() ?? null,
        endTime: b?.endTime?.toISOString() ?? null,
        status: 'cancelled',
      }
    },
    rescheduleInfo: async (tenantId: string, id: string, token: string) => {
      const { verifyApprovalToken } = await import('./approvalTokens')
      if (!verifyApprovalToken('job', id, tenantId, token)) {
        throw new ApiError('Invalid or expired reschedule token', 403)
      }
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          bookings: {
            include: { service: true },
            orderBy: { startTime: 'asc' },
          },
        },
      })
      if (!job) throw new ApiError('Job not found', 404)
      const primaryBooking = (job as any).bookings?.[0]
      if (!primaryBooking) throw new ApiError('Booking not found', 404)

      const service = (primaryBooking as any)?.service
      const bookingSettings = (service?.bookingSettings as any) || {}
      const requireConfirmation = bookingSettings?.requireConfirmation ?? false

      return {
        jobId: job.id,
        tenantId: job.tenantId,
        serviceId: primaryBooking.serviceId,
        serviceName: service?.name || 'Service',
        startTime: primaryBooking.startTime?.toISOString() ?? null,
        endTime: primaryBooking.endTime?.toISOString() ?? null,
        location: primaryBooking.location ?? job.location ?? null,
        requireConfirmation,
        contact: job.contact
          ? {
              firstName: job.contact.firstName,
              lastName: job.contact.lastName,
            }
          : null,
      }
    },
    reschedulePublic: async (
      tenantId: string,
      id: string,
      token: string,
      payload: { startTime: string }
    ) => {
      const { verifyApprovalToken } = await import('./approvalTokens')
      if (!verifyApprovalToken('job', id, tenantId, token)) {
        throw new ApiError('Invalid or expired reschedule token', 403)
      }

      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          bookings: {
            include: { service: true },
            orderBy: { startTime: 'asc' },
          },
        },
      })
      if (!job) throw new ApiError('Job not found', 404)
      const primaryBooking = (job as any).bookings?.[0]
      if (!primaryBooking) throw new ApiError('Booking not found', 404)

      const service = (primaryBooking as any)?.service
      if (!service) throw new ApiError('Service not found', 404)

      const newStartTime = parseValidDate(payload.startTime)
      if (!newStartTime) throw new ApiError('Invalid startTime format', 400)

      const duration = (service as any).duration || 60
      const newEndTime = new Date(newStartTime.getTime() + duration * 60 * 1000)

      const bookingSettings = (service.bookingSettings as any) || {}
      const requireConfirmation = bookingSettings?.requireConfirmation ?? false

      const availability = (service.availability as any) || {}
      const rescheduleTzSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: service.tenantId },
      })
      const timezoneOffset =
        availability?.timezoneOffset ??
        offsetHoursForZone(rescheduleTzSettings?.timezone, newStartTime)

      const dayOfWeek = newStartTime.getDay()
      const workingHours = availability?.workingHours?.find((wh: any) => wh.dayOfWeek === dayOfWeek)
      if (!workingHours || !workingHours.isWorking) {
        throw new ApiError('Service is not available on this day', 400)
      }

      const now = new Date()
      if (newStartTime < now) {
        throw new ApiError('Cannot reschedule to a time in the past', 400)
      }

      const newStatus = requireConfirmation ? 'pending-confirmation' : 'active'
      await prisma.booking.update({
        where: { id: primaryBooking.id },
        data: {
          startTime: newStartTime,
          endTime: newEndTime,
          status: newStatus,
        },
      })

      if (requireConfirmation) {
        try {
          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })
          const companyName = settings?.companyDisplayName || 'JobDock'
          const pref = (job.contact as any)?.notificationPreference ?? 'both'
          const wantsEmail = shouldSendEmail(pref) && job.contact?.email
          const wantsSms = shouldSendSms(pref) && job.contact?.phone?.trim()

          if (wantsEmail) {
            const emailPayload = buildClientPendingEmail({
              clientName: `${job.contact!.firstName} ${job.contact!.lastName}`.trim(),
              serviceName: service.name,
              startTime: newStartTime,
              endTime: newEndTime,
              timezoneOffset,
              companyName,
              logoUrl: null,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
              jobId: job.id,
              rescheduleToken: token,
            })
            await sendEmail({
              ...emailPayload,
              to: job.contact!.email!,
              fromName: companyName,
              replyTo: settings?.companySupportEmail || undefined,
            })
          }
          if (wantsSms) {
            let smsRescheduleUrl: string | undefined
            try {
              const { createShortLink } = await import('./shortLinks')
              const publicAppUrl = (
                process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
              ).replace(/\/$/, '')
              smsRescheduleUrl = await createShortLink(
                `${publicAppUrl}/public/booking/${job.id}/reschedule?token=${token}`
              )
            } catch {
              /* ignore */
            }
            const smsBody = buildBookingPendingSms({
              serviceName: service.name,
              startTime: newStartTime,
              companyName,
              timezoneOffset,
              rescheduleUrl: smsRescheduleUrl,
            })
            await sendSms(job.contact!.phone!, smsBody)
          }

          const ownerUser = await prisma.user.findFirst({
            where: { tenantId, role: 'owner' },
            select: { email: true },
          })
          const contractorEmail = ownerUser?.email ?? settings?.companySupportEmail ?? undefined
          if (contractorEmail) {
            const emailPayload = buildContractorNotificationEmail({
              contractorName: 'Contractor',
              serviceName: service.name,
              clientName: `${job.contact!.firstName} ${job.contact!.lastName}`.trim(),
              clientEmail: job.contact?.email ?? undefined,
              clientPhone: job.contact?.phone ?? undefined,
              startTime: newStartTime,
              endTime: newEndTime,
              location: primaryBooking.location ?? job.location ?? undefined,
              isPending: true,
              companyName,
              logoUrl: null,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
            })
            await sendEmail({
              ...emailPayload,
              to: contractorEmail,
              fromName: companyName,
              replyTo: settings?.companySupportEmail || undefined,
            })
          }
        } catch (e) {
          console.error('Failed to send reschedule notification:', e)
        }
      } else {
        try {
          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })
          const companyName = settings?.companyDisplayName || 'JobDock'
          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
            } catch {
              /* ignore */
            }
          }
          const pref = (job.contact as any)?.notificationPreference ?? 'both'
          const wantsEmail = shouldSendEmail(pref) && job.contact?.email
          const wantsSms = shouldSendSms(pref) && job.contact?.phone?.trim()

          const rescheduleToken = generateApprovalToken('job', job.id, tenantId)
          let smsRescheduleUrl: string | undefined
          if (wantsSms) {
            try {
              const { createShortLink } = await import('./shortLinks')
              const publicAppUrl = (
                process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
              ).replace(/\/$/, '')
              smsRescheduleUrl = await createShortLink(
                `${publicAppUrl}/public/booking/${job.id}/reschedule?token=${rescheduleToken}`
              )
            } catch {
              /* ignore */
            }
          }

          if (wantsEmail) {
            const emailPayload = buildClientConfirmationEmail({
              clientName: `${job.contact!.firstName} ${job.contact!.lastName}`.trim(),
              serviceName: service.name,
              startTime: newStartTime,
              endTime: newEndTime,
              location: primaryBooking.location ?? job.location ?? undefined,
              timezoneOffset,
              companyName,
              logoUrl,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
              jobId: job.id,
              rescheduleToken,
            })
            await sendEmail({
              ...emailPayload,
              to: job.contact!.email!,
              fromName: companyName,
              replyTo: settings?.companySupportEmail || undefined,
            })
          }
          if (wantsSms) {
            const smsBody = buildBookingConfirmationSms({
              serviceName: service.name,
              startTime: newStartTime,
              companyName,
              timezoneOffset,
              rescheduleUrl: smsRescheduleUrl,
            })
            await sendSms(job.contact!.phone!, smsBody)
          }
        } catch (e) {
          console.error('Failed to send reschedule confirmation:', e)
        }
      }

      const updatedJob = await prisma.job.findFirst({
        where: { id },
        include: {
          contact: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
        },
      })
      const b = (updatedJob as any)?.bookings?.[0]
      return {
        ...updatedJob,
        serviceId: b?.serviceId,
        service: (b as any)?.service,
        startTime: b?.startTime?.toISOString() ?? null,
        endTime: b?.endTime?.toISOString() ?? null,
        status: b?.status ?? 'active',
        requireConfirmation,
      }
    },
  },
  bookings: {
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)

      const isIndependent = payload.isIndependent === true

      if (isIndependent) {
        // Independent appointment: no job, title required, contact optional
        const title =
          payload.title && typeof payload.title === 'string' ? payload.title.trim() : null
        if (!title) throw new ApiError('title is required for independent appointments', 400)

        const normalizedAssignedTo = normalizeAssignedTo(payload.assignedTo)
        if (normalizedAssignedTo) await validateAssignedTo(tenantId, normalizedAssignedTo)

        const requestedStart =
          payload.startTime !== undefined && payload.startTime !== null && payload.startTime !== ''
            ? parseValidDate(payload.startTime)
            : null
        const requestedEnd =
          payload.endTime !== undefined && payload.endTime !== null && payload.endTime !== ''
            ? parseValidDate(payload.endTime)
            : null

        const toBeScheduled = payload.toBeScheduled === true || (!requestedStart && !requestedEnd)

        if (!toBeScheduled && (!requestedStart || !requestedEnd)) {
          throw new ApiError('startTime and endTime are required for scheduled appointments', 400)
        }
        if ((requestedStart && !requestedEnd) || (!requestedStart && requestedEnd)) {
          throw new ApiError('Both startTime and endTime must be provided', 400)
        }

        const contactId =
          payload.contactId && typeof payload.contactId === 'string'
            ? payload.contactId.trim()
            : null
        if (contactId) {
          const contact = await prisma.contact.findFirst({
            where: { id: contactId, tenantId },
          })
          if (!contact) throw new ApiError('Contact not found', 404)
        }

        const booking = await prisma.booking.create({
          data: {
            tenantId,
            jobId: null,
            title,
            contactId,
            serviceId: payload.serviceId ?? null,
            quoteId: null,
            invoiceId: null,
            startTime: toBeScheduled ? null : requestedStart,
            endTime: toBeScheduled ? null : requestedEnd,
            toBeScheduled,
            status: payload.status ?? 'active',
            location: payload.location ?? null,
            price: payload.price !== undefined ? payload.price : null,
            notes: payload.notes ?? null,
            assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
            breaks: payload.breaks ?? null,
            isIndependent: true,
            createdById: payload.createdById ?? payload._actingUserId ?? null,
          },
          include: {
            service: true,
            contact: true,
            createdBy: { select: { name: true } },
          },
        })

        return {
          ...booking,
          price: booking.price != null ? Number(booking.price) : null,
          startTime: booking.startTime?.toISOString() ?? null,
          endTime: booking.endTime?.toISOString() ?? null,
          isIndependent: true,
          job: null,
          contactName: (booking as any).contact
            ? `${(booking as any).contact.firstName ?? ''} ${(booking as any).contact.lastName ?? ''}`.trim()
            : undefined,
          createdByName: ((booking as any).createdBy as any)?.name ?? undefined,
        }
      }

      // Job-backed booking
      const jobId = payload.jobId
      if (!jobId || typeof jobId !== 'string') {
        throw new ApiError('jobId is required for job-backed bookings', 400)
      }

      const job = await prisma.job.findFirst({
        where: { id: jobId, tenantId },
        include: { contact: true, createdBy: { select: { name: true } }, service: true },
      })
      if (!job) throw new ApiError('Job not found', 404)

      const normalizedAssignedTo = normalizeAssignedTo(
        payload.assignedTo ?? (job as any).assignedTo
      )
      if (normalizedAssignedTo) await validateAssignedTo(tenantId, normalizedAssignedTo)

      const requestedStart =
        payload.startTime !== undefined && payload.startTime !== null && payload.startTime !== ''
          ? parseValidDate(payload.startTime)
          : null
      const requestedEnd =
        payload.endTime !== undefined && payload.endTime !== null && payload.endTime !== ''
          ? parseValidDate(payload.endTime)
          : null

      const toBeScheduled = payload.toBeScheduled === true || (!requestedStart && !requestedEnd)

      if (!toBeScheduled && (!requestedStart || !requestedEnd)) {
        throw new ApiError('startTime and endTime are required for scheduled bookings', 400)
      }
      if ((requestedStart && !requestedEnd) || (!requestedStart && requestedEnd)) {
        throw new ApiError('Both startTime and endTime must be provided', 400)
      }

      const booking = await prisma.booking.create({
        data: {
          tenantId,
          jobId: job.id,
          serviceId: payload.serviceId ?? (job as any).serviceId ?? null,
          quoteId: payload.quoteId ?? (job as any).quoteId ?? null,
          invoiceId: payload.invoiceId ?? (job as any).invoiceId ?? null,
          startTime: toBeScheduled ? null : requestedStart,
          endTime: toBeScheduled ? null : requestedEnd,
          toBeScheduled,
          status: payload.status ?? 'active',
          location: payload.location ?? job.location ?? null,
          price:
            payload.price !== undefined
              ? payload.price
              : (job as any).price != null
                ? Number((job as any).price)
                : null,
          notes: payload.notes ?? job.notes ?? null,
          assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
          breaks: payload.breaks ?? null,
          createdById: payload.createdById ?? payload._actingUserId ?? null,
        },
        include: {
          service: true,
        },
      })

      return {
        ...booking,
        price: booking.price != null ? Number(booking.price) : null,
        startTime: booking.startTime?.toISOString() ?? null,
        endTime: booking.endTime?.toISOString() ?? null,
        job: {
          id: job.id,
          title: job.title,
          contactId: job.contactId,
          contactName: job.contact
            ? `${job.contact.firstName ?? ''} ${job.contact.lastName ?? ''}`.trim()
            : undefined,
          createdByName: (job.createdBy as any)?.name ?? undefined,
        },
      }
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)

      const existing = await prisma.booking.findFirst({
        where: { id, tenantId },
        include: { contact: true, service: true, createdBy: { select: { name: true } } },
      })
      if (!existing) throw new ApiError('Booking not found', 404)
      if (!existing.isIndependent) {
        throw new ApiError(
          'Use job update to modify job-backed bookings. This endpoint is for independent appointments only.',
          400
        )
      }

      const normalizedAssignedTo =
        payload.assignedTo !== undefined ? normalizeAssignedTo(payload.assignedTo) : null
      if (normalizedAssignedTo) await validateAssignedTo(tenantId, normalizedAssignedTo)

      const requestedStart =
        payload.startTime !== undefined && payload.startTime !== null && payload.startTime !== ''
          ? parseValidDate(payload.startTime)
          : undefined
      const requestedEnd =
        payload.endTime !== undefined && payload.endTime !== null && payload.endTime !== ''
          ? parseValidDate(payload.endTime)
          : undefined
      const toBeScheduled = payload.toBeScheduled
      if (toBeScheduled === false && (requestedStart || requestedEnd)) {
        if (!requestedStart || !requestedEnd) {
          throw new ApiError(
            'Both startTime and endTime must be provided for scheduled appointments',
            400
          )
        }
      }
      if (toBeScheduled !== true && requestedStart && !requestedEnd) {
        throw new ApiError('Both startTime and endTime must be provided', 400)
      }

      const updateData: Prisma.BookingUpdateInput = {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.contactId !== undefined && { contactId: payload.contactId || null }),
        ...(payload.serviceId !== undefined && { serviceId: payload.serviceId || null }),
        ...(payload.location !== undefined && { location: payload.location ?? null }),
        ...(payload.notes !== undefined && { notes: payload.notes ?? null }),
        ...(payload.status !== undefined && { status: payload.status }),
        ...(payload.price !== undefined && { price: payload.price }),
        ...(payload.breaks !== undefined && { breaks: payload.breaks }),
        ...(normalizedAssignedTo !== null && {
          assignedTo: normalizedAssignedTo as unknown as Prisma.InputJsonValue,
        }),
        ...(payload.createdById !== undefined && {
          createdById: payload.createdById ?? payload._actingUserId ?? null,
        }),
      }
      if (toBeScheduled !== undefined) updateData.toBeScheduled = toBeScheduled
      if (requestedStart !== undefined) updateData.startTime = requestedStart ?? null
      if (requestedEnd !== undefined) updateData.endTime = requestedEnd ?? null

      const updated = await prisma.booking.update({
        where: { id },
        data: updateData,
        include: { contact: true, service: true, createdBy: { select: { name: true } } },
      })

      // Reschedule notification for independent bookings: when notifyClient is true and date/time changed
      const timesChanged = payload.startTime !== undefined || payload.endTime !== undefined
      if (
        payload.notifyClient === true &&
        timesChanged &&
        updated.startTime &&
        updated.endTime &&
        updated.contact
      ) {
        try {
          const contact = updated.contact as (Contact & { notificationPreference?: string }) | null
          const pref = contact?.notificationPreference ?? 'both'
          const wantsEmail = shouldSendEmail(pref)
          const wantsSms = shouldSendSms(pref)
          const clientEmail = contact?.email?.trim() || null
          const clientPhone = contact?.phone?.trim() || null

          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })
          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              const { getFileUrl } = await import('./fileUpload')
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
            } catch (error) {
              console.error('Error fetching logo URL for reschedule email:', error)
            }
          }
          const companyName = settings?.companyDisplayName || 'JobDock'
          const timezoneOffset = offsetHoursForZone(
            settings?.timezone,
            updated.startTime ? new Date(updated.startTime) : new Date()
          )
          const serviceName = (updated as any).service?.name || updated.title || 'Appointment'

          if (wantsEmail && clientEmail) {
            console.log(`📧 Sending reschedule email to ${clientEmail} (independent booking)`)
            const clientName = contact
              ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'there'
              : 'there'
            const emailPayload = buildClientRescheduleEmail({
              clientName,
              serviceName,
              startTime: new Date(updated.startTime),
              endTime: new Date(updated.endTime),
              location: updated.location ?? undefined,
              timezoneOffset,
              companyName,
              logoUrl,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
            })
            await sendEmail({
              ...emailPayload,
              to: clientEmail,
              fromName: companyName,
              replyTo: settings?.companySupportEmail || undefined,
            })
            console.log('✅ Independent booking reschedule email sent successfully')
          }
          if (wantsSms && clientPhone) {
            console.log(`📱 Sending reschedule SMS to ${clientPhone} (independent booking)`)
            const smsBody = buildRescheduleNotificationSms({
              serviceName,
              startTime: new Date(updated.startTime),
              companyName,
              timezoneOffset,
            })
            await sendSms(clientPhone, smsBody)
            console.log('✅ Independent booking reschedule SMS sent successfully')
          }
        } catch (rescheduleError) {
          console.error(
            '❌ Failed to send independent booking reschedule notification:',
            rescheduleError
          )
        }
      }

      return {
        ...updated,
        price: updated.price != null ? Number(updated.price) : null,
        startTime: updated.startTime?.toISOString() ?? null,
        endTime: updated.endTime?.toISOString() ?? null,
        isIndependent: true,
        job: null,
        contactName: updated.contact
          ? `${updated.contact.firstName ?? ''} ${updated.contact.lastName ?? ''}`.trim()
          : undefined,
        createdByName:
          (updated as { createdBy?: { name: string } | null }).createdBy?.name ?? undefined,
      }
    },
    delete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      await ensureTenantExists(tenantId)

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
      })

      if (!booking) throw new ApiError('Booking not found', 404)

      // Series archive ("Delete series" on the calendar): archive EVERY booking in the
      // recurrence — including the staged monthly anchor — but never the Job. Calendar deletes
      // only ever affect bookings; the job stays on the Jobs page. One shared timestamp lets
      // restore undo exactly this operation.
      if (deleteAll && booking.recurrenceId) {
        await prisma.booking.updateMany({
          where: { recurrenceId: booking.recurrenceId, tenantId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return { success: true }
      }

      // Single booking archive (independent or job-backed): booking only, job untouched.
      await prisma.booking.update({
        where: { id },
        data: { archivedAt: new Date() },
      })

      return { success: true }
    },
    permanentDelete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      await ensureTenantExists(tenantId)

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
      })

      if (!booking) throw new ApiError('Booking not found', 404)

      // Series permanent delete: hard-delete EVERY booking in the recurrence (incl. the staged
      // anchor, so no monthly chip lingers). Never deletes the Job — deleting jobs is a
      // Jobs-page-only action.
      if (deleteAll && booking.recurrenceId) {
        await prisma.booking.deleteMany({
          where: { recurrenceId: booking.recurrenceId, tenantId },
        })
        return { success: true, permanent: true }
      }

      // Independent and job-backed both get permanently deleted the same way
      await prisma.booking.delete({
        where: { id },
      })

      return { success: true, permanent: true }
    },
    restore: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
        include: { job: true },
      })
      if (!booking) throw new ApiError('Booking not found', 404)
      if (!booking.archivedAt) throw new ApiError('Booking is not archived', 400)

      const updated = await prisma.booking.update({
        where: { id },
        data: { archivedAt: null },
      })
      // An appointment can't surface while its parent job is archived — bring the job back too.
      if (booking.job?.archivedAt) {
        await prisma.job.update({
          where: { id: booking.job.id },
          data: { archivedAt: null },
        })
      }
      return { success: true, bookingId: updated.id, jobId: booking.job?.id ?? null }
    },
  },
  services: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      return prisma.service.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
    },
    // Get all active services for a tenant (for public booking)
    getAllActiveForTenant: async (tenantId: string) => {
      return prisma.service.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      })
    },
    getById: async (tenantId: string, id: string) => {
      // Public booking resolves requests with a placeholder tenant and legitimately
      // needs to look up a service by its (globally unique) id alone so the booking
      // page can render. For every authenticated caller we MUST scope by tenantId,
      // otherwise any user could read another tenant's service by guessing its id.
      const isPublicLookup = tenantId === 'public-booking-placeholder'
      const service = isPublicLookup
        ? await prisma.service.findUnique({ where: { id } })
        : await prisma.service.findFirst({ where: { id, tenantId } })
      if (!service) throw new Error('Service not found')
      return service
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      return prisma.service.create({
        data: {
          tenantId,
          name: payload.name,
          description: payload.description,
          duration: payload.duration,
          price: payload.price,
          isActive: payload.isActive ?? true,
          availability: payload.availability,
          bookingSettings: payload.bookingSettings,
        },
      })
    },
    update: async (tenantId: string, id: string, payload: any) => {
      // Verify service belongs to tenant before updating
      const existingService = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!existingService) {
        throw new ApiError('Service not found', 404)
      }
      return prisma.service.update({
        where: { id },
        data: payload,
      })
    },
    delete: async (tenantId: string, id: string) => {
      // Verify service belongs to tenant before deleting
      const service = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!service) {
        throw new ApiError('Service not found', 404)
      }
      await prisma.service.delete({ where: { id } })
      return { success: true }
    },
    getBookingLink: async (tenantId: string, id: string) => {
      const service = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!service) {
        throw new ApiError('Service not found', 404)
      }
      const baseUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
      return {
        serviceId: id,
        serviceName: service.name,
        publicLink: `${baseUrl}/book/${id}`,
        embedCode: `<iframe src="${baseUrl}/book/${id}" width="100%" height="600" frameborder="0"></iframe>`,
      }
    },
    getAvailability: async (tenantId: string, id: string, startDate?: Date, endDate?: Date) => {
      // For public booking, look up service by ID only (ignore tenantId parameter)
      // The service ID is globally unique and determines the tenant
      const service = await prisma.service.findUnique({
        where: { id },
      })
      if (!service) throw new Error('Service not found')
      if (!service.isActive) throw new Error('Service is not active')

      // Use the service's actual tenantId for all subsequent operations
      const actualTenantId = service.tenantId

      const availability = service.availability as any
      if (!availability || !availability.workingHours) {
        throw new Error('Service has no availability configured')
      }

      // Local time for advertised slots comes from the tenant's timezone (DST-correct), with any
      // explicit per-service availability.timezoneOffset still taking precedence; null tenant tz
      // falls back to the legacy -8. One offset is used for the whole window, so a DST transition
      // mid-window could shift later slots by an hour — acceptable for a booking range.
      const availabilityTzSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: actualTenantId },
      })
      const timezoneOffset =
        availability.timezoneOffset ??
        offsetHoursForZone(availabilityTzSettings?.timezone, new Date())

      const now = new Date()
      const advanceBookingDays = availability.advanceBookingDays || 30
      const sameDayBooking = availability.sameDayBooking ?? false
      const bufferTime = availability.bufferTime || 0
      const duration = service.duration
      const maxBookingsPerSlot = (service.bookingSettings as any)?.maxBookingsPerSlot || 1

      console.log('🔍 Availability calculation:', {
        serviceId: id,
        serviceName: service.name,
        now: now.toISOString(),
        nowDayOfWeek: now.getDay(),
        timezoneOffset,
        advanceBookingDays,
        sameDayBooking,
        bufferTime,
        duration,
        workingHoursCount: availability.workingHours?.length,
      })

      // Calculate date range
      const rangeStart = startDate || now
      const rangeEnd = endDate || new Date(now.getTime() + advanceBookingDays * 24 * 60 * 60 * 1000)

      // Fetch all relevant bookings in the range
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId: actualTenantId,
          serviceId: id,
          status: { in: ['active', 'scheduled', 'in-progress', 'pending-confirmation'] },
          deletedAt: null,
          archivedAt: null,
          toBeScheduled: false,
          startTime: { lte: rangeEnd },
          endTime: { gte: rangeStart },
        },
      })

      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + minutes
      }

      const countOverlappingJobs = (slotStart: Date, slotEnd: Date): number => {
        return bookings.filter(b => {
          if (!b.startTime || !b.endTime) return false
          const bStart = new Date(b.startTime)
          const bEnd = new Date(b.endTime)
          return slotStart < bEnd && slotEnd > bStart
        }).length
      }

      // Generate slots for each day in range
      const slotsData: { date: string; slots: { start: string; end: string }[] }[] = []

      const currentDay = new Date(rangeStart)
      currentDay.setHours(0, 0, 0, 0)

      while (currentDay <= rangeEnd) {
        const dayOfWeek = currentDay.getDay()
        const workingHours = availability.workingHours.find((wh: any) => wh.dayOfWeek === dayOfWeek)

        console.log(`📅 Checking ${currentDay.toISOString().split('T')[0]} (day ${dayOfWeek}):`, {
          hasWorkingHours: !!workingHours,
          isWorking: workingHours?.isWorking,
          hours: workingHours ? `${workingHours.startTime}-${workingHours.endTime}` : 'N/A',
        })

        if (workingHours && workingHours.isWorking) {
          const daySlots: { start: string; end: string }[] = []

          const startMinutes = timeToMinutes(workingHours.startTime)
          const endMinutes = timeToMinutes(workingHours.endTime)
          const slotDuration = duration + bufferTime

          for (
            let minutes = startMinutes;
            minutes + duration <= endMinutes;
            minutes += slotDuration
          ) {
            const slotStart = new Date(currentDay)
            // Apply timezone offset: working hours are in business local time
            // Lambda runs in UTC, so we need to offset the hours
            const adjustedHours = Math.floor(minutes / 60) - timezoneOffset
            slotStart.setHours(adjustedHours, minutes % 60, 0, 0)

            const slotEnd = new Date(slotStart)
            slotEnd.setMinutes(slotEnd.getMinutes() + duration)

            // Skip if slot is in the past
            if (slotStart < now) continue

            // Skip same-day bookings if not allowed
            if (!sameDayBooking && slotStart.toDateString() === now.toDateString()) continue

            // Skip if outside advance booking window
            const daysInFuture = (slotStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            if (daysInFuture > advanceBookingDays) continue

            // Check for overlapping jobs
            const overlappingCount = countOverlappingJobs(slotStart, slotEnd)
            if (overlappingCount < maxBookingsPerSlot) {
              daySlots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
              })
            }
          }

          if (daySlots.length > 0) {
            console.log(`  ✅ Added ${daySlots.length} slots for this day`)
            slotsData.push({
              date: currentDay.toISOString().split('T')[0],
              slots: daySlots,
            })
          } else {
            console.log(`  ❌ No slots generated for this day`)
          }
        }

        currentDay.setDate(currentDay.getDate() + 1)
      }

      console.log(`🎯 Final result: ${slotsData.length} days with availability`)

      return {
        serviceId: id,
        slots: slotsData,
      }
    },
    bookSlot: async (tenantId: string, id: string, payload: any, contractorEmail?: string) => {
      const bookResult = await prisma.$transaction(async tx => {
        // 1. Load and validate service
        // For public booking, look up service by ID only (ignore tenantId parameter)
        const service = await tx.service.findUnique({
          where: { id },
        })
        if (!service) throw new Error('Service not found')
        if (!service.isActive) throw new Error('Service is not active')

        // Use the service's actual tenantId for all subsequent operations
        const actualTenantId = service.tenantId

        const availability = service.availability as any
        const bookingSettings = service.bookingSettings as any
        const maxBookingsPerSlot = (bookingSettings as any)?.maxBookingsPerSlot || 1
        // Tenant timezone drives local slot times (DST-correct at the slot instant); an explicit
        // per-service availability.timezoneOffset still wins; null tenant tz falls back to -8.
        const bookingTzSettings = await tx.tenantSettings.findUnique({
          where: { tenantId: actualTenantId },
        })
        const timezoneOffset =
          availability.timezoneOffset ??
          offsetHoursForZone(bookingTzSettings?.timezone, new Date(payload.startTime)) // legacy -8 fallback
        const startTime = new Date(payload.startTime)
        const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000)
        const now = new Date()

        // 2. Validate slot timing
        if (startTime < now) {
          throw new Error('Cannot book slots in the past')
        }

        const dayOfWeek = startTime.getDay()
        const workingHours = availability?.workingHours?.find(
          (wh: any) => wh.dayOfWeek === dayOfWeek
        )

        if (!workingHours || !workingHours.isWorking) {
          throw new Error('Service is not available on this day')
        }

        // Validate time is within working hours (accounting for timezone offset)
        // The incoming time is in UTC, working hours are in business local time
        const localStartHour = startTime.getHours() + timezoneOffset
        const localEndHour = endTime.getHours() + timezoneOffset
        const startMinutes = localStartHour * 60 + startTime.getMinutes()
        const endMinutes = localEndHour * 60 + endTime.getMinutes()
        const workStartMinutes =
          parseInt(workingHours.startTime.split(':')[0]) * 60 +
          parseInt(workingHours.startTime.split(':')[1])
        const workEndMinutes =
          parseInt(workingHours.endTime.split(':')[0]) * 60 +
          parseInt(workingHours.endTime.split(':')[1])

        if (startMinutes < workStartMinutes || endMinutes > workEndMinutes) {
          throw new Error('Slot is outside working hours')
        }

        // Validate advance booking rules
        const sameDayBooking = availability?.sameDayBooking ?? false
        if (!sameDayBooking && startTime.toDateString() === now.toDateString()) {
          throw new Error('Same-day booking is not allowed')
        }

        const advanceBookingDays = availability?.advanceBookingDays || 30
        const daysInFuture = (startTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        if (daysInFuture > advanceBookingDays) {
          throw new Error('Booking is too far in advance')
        }

        // Public bookings enforce the service's slot capacity (tenant-wide, like the recurring
        // branch below and the availability endpoint that advertises the slots). Internal
        // calendar double-booking remains allowed — this guard is public-flow only.
        const overlappingAtSlot = await tx.booking.count({
          where: {
            tenantId: actualTenantId,
            // Count per-service, matching the availability endpoint that advertised this slot
            // (it filters serviceId). Without this, an internal job or another service's booking
            // in the same slot would reject a slot the customer was just shown as open.
            serviceId: id,
            status: { in: ['active', 'scheduled', 'in-progress', 'pending-confirmation'] },
            deletedAt: null,
            archivedAt: null,
            toBeScheduled: false,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        })
        if (overlappingAtSlot >= maxBookingsPerSlot) {
          throw new Error('This time slot is no longer available. Please choose another time.')
        }

        // 4. Upsert contact
        let contact
        const contactData = payload.contact || {}

        if (contactData.id) {
          contact = await tx.contact.findFirst({
            where: { id: contactData.id, tenantId: actualTenantId },
          })
          if (!contact) throw new Error('Contact not found')
        } else if (contactData.email) {
          contact = await tx.contact.findFirst({
            where: { email: contactData.email, tenantId: actualTenantId },
          })
        }

        if (!contact) {
          // Create new contact - split name if provided
          const fullName = contactData.name || ''
          const nameParts = fullName.trim().split(/\s+/)
          const firstName = nameParts[0] || 'Guest'
          const lastName = nameParts.slice(1).join(' ') || ''

          contact = await tx.contact.create({
            data: {
              tenantId: actualTenantId,
              firstName,
              lastName,
              email: contactData.email,
              phone: contactData.phone,
              company: contactData.company,
              address: contactData.address,
              notes: contactData.notes,
              status: 'customer',
            },
          })
        } else {
          // Update existing contact if address or phone is provided
          const updateData: { address?: string; phone?: string } = {}
          if (contactData.address !== undefined)
            updateData.address = contactData.address || undefined
          if (contactData.phone !== undefined && contactData.phone?.trim())
            updateData.phone = contactData.phone.trim()
          if (Object.keys(updateData).length > 0) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: updateData,
            })
          }
        }

        // 5. Create job(s)
        // Set status based on whether confirmation is required
        const requireConfirmation = bookingSettings?.requireConfirmation ?? false
        const initialStatus = requireConfirmation ? 'pending-confirmation' : 'active'

        let job: any

        // If recurrence is provided, create recurring jobs inline
        if (payload.recurrence) {
          const recurrence = payload.recurrence
          const title = `${service.name} with ${contact.firstName} ${contact.lastName}`.trim()

          // Create the JobRecurrence record
          const jobRecurrence = await tx.jobRecurrence.create({
            data: {
              tenantId: actualTenantId,
              contactId: contact.id,
              serviceId: service.id,
              title,
              location: payload.location,
              notes: payload.notes,
              status: 'active',
              frequency: recurrence.frequency,
              interval: recurrence.interval,
              count: recurrence.count,
              untilDate: recurrence.untilDate ? new Date(recurrence.untilDate) : null,
              daysOfWeek: recurrence.daysOfWeek || [],
              startTime,
              endTime,
            },
          })

          // Generate all occurrence instances
          const instances = generateRecurrenceInstances({
            startTime,
            endTime,
            recurrence,
          })

          // Check for conflicts across all instances
          const conflicts: Array<{ date: string; time: string }> = []

          for (const instance of instances) {
            const overlappingBookings = await tx.booking.count({
              where: {
                tenantId: actualTenantId,
                // Per-service, matching the availability endpoint (see the single-slot check above).
                serviceId: id,
                status: { in: ['active', 'scheduled', 'in-progress', 'pending-confirmation'] },
                deletedAt: null,
                archivedAt: null,
                toBeScheduled: false,
                startTime: { lt: instance.endTime },
                endTime: { gt: instance.startTime },
              },
            })

            if (overlappingBookings >= maxBookingsPerSlot) {
              conflicts.push({
                date: instance.startTime.toISOString().split('T')[0],
                time: instance.startTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            }
          }

          if (conflicts.length > 0) {
            const conflictSummary = conflicts
              .slice(0, 5)
              .map(c => `${c.date} at ${c.time}`)
              .join('; ')
            const moreText = conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : ''

            throw new ApiError(
              `Cannot create recurring schedule due to conflicts: ${conflictSummary}${moreText}`,
              409
            )
          }

          const jobLocation = payload.location || contactData.address || undefined

          const createdJob = await tx.job.create({
            data: {
              tenantId: actualTenantId,
              title,
              contactId: contact.id,
              status: 'active',
              location: jobLocation,
              notes: payload.notes,
            },
            include: { contact: true },
          })

          const bookings = await Promise.all(
            instances.map(instance =>
              tx.booking.create({
                data: {
                  tenantId: actualTenantId,
                  jobId: createdJob.id,
                  serviceId: service.id,
                  recurrenceId: jobRecurrence.id,
                  startTime: instance.startTime,
                  endTime: instance.endTime,
                  toBeScheduled: false,
                  status: initialStatus,
                  location: jobLocation,
                  notes: payload.notes,
                },
                include: { service: true },
              })
            )
          )

          job = {
            ...createdJob,
            ...bookings[0],
            // Restore job identity after the booking spread — the booking's id
            // would otherwise leak into the reschedule token/URL below, making
            // every emailed/SMS'd reschedule link resolve to a missing job (404).
            id: createdJob.id,
            title: createdJob.title,
            contactId: createdJob.contactId,
            bookingId: bookings[0].id,
            serviceId: service.id,
            service,
            startTime: bookings[0].startTime,
            endTime: bookings[0].endTime,
            status: initialStatus,
            recurrenceId: jobRecurrence.id,
            occurrenceCount: bookings.length,
          }
        } else {
          const jobLocation = payload.location || contactData.address || undefined

          const createdJob = await tx.job.create({
            data: {
              tenantId: actualTenantId,
              title: `${service.name} with ${contact.firstName} ${contact.lastName}`.trim(),
              contactId: contact.id,
              status: 'active',
              location: jobLocation,
              notes: payload.notes,
            },
            include: { contact: true },
          })

          const booking = await tx.booking.create({
            data: {
              tenantId: actualTenantId,
              jobId: createdJob.id,
              serviceId: service.id,
              startTime,
              endTime,
              toBeScheduled: false,
              status: initialStatus,
              location: jobLocation,
              notes: payload.notes,
            },
            include: { service: true },
          })

          job = {
            ...createdJob,
            ...booking,
            // Restore job identity after the booking spread — the booking's id
            // would otherwise leak into the reschedule token/URL below, making
            // every emailed/SMS'd reschedule link resolve to a missing job (404).
            id: createdJob.id,
            title: createdJob.title,
            contactId: createdJob.contactId,
            bookingId: booking.id,
            serviceId: service.id,
            service,
            startTime,
            endTime,
            status: initialStatus,
          }
        }

        return {
          job,
          contact,
          service,
          startTime,
          endTime,
          requireConfirmation,
          contactData,
          bookingTzSettings,
          actualTenantId,
        }
      })

      const {
        job,
        contact,
        service,
        startTime,
        endTime,
        requireConfirmation,
        contactData,
        bookingTzSettings,
        actualTenantId,
      } = bookResult

      // 6. Send notification emails AFTER the transaction commits. Awaiting Resend/Twilio inside the
      // transaction held a DB connection across those HTTP calls and, worse, could trip Prisma's
      // interactive-transaction timeout and roll back a booking whose confirmation was already sent.
      // Emails are best-effort; a failure here never undoes the committed booking.
      try {
        const clientEmail = contact.email
        const clientName = `${contact.firstName} ${contact.lastName}`.trim()

        // Get tenant settings for company name and reply-to email
        const settings = await prisma.tenantSettings.findUnique({
          where: { tenantId: actualTenantId },
        })

        const companyName = settings?.companyDisplayName || 'JobDock'
        const replyToEmail = settings?.companySupportEmail || undefined

        // Get timezone offset from service availability settings, falling back to the tenant
        // timezone loaded above (DST-correct at the booked slot's start), then legacy -8.
        const availability = service.availability as any
        const timezoneOffset =
          availability?.timezoneOffset ??
          offsetHoursForZone(bookingTzSettings?.timezone, startTime)

        // Fetch logo URL if available (7 days expiration for email)
        let logoUrl: string | null = null
        if (settings?.logoUrl) {
          try {
            const { getFileUrl } = await import('./fileUpload')
            logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
          } catch (error) {
            console.error('Error fetching logo URL for email:', error)
          }
        }

        const phoneForSms = contactData.phone?.trim() || contact.phone
        const pref = (contact as any)?.notificationPreference ?? 'both'
        const wantsEmail = shouldSendEmail(pref) && clientEmail
        const wantsSms = shouldSendSms(pref) && phoneForSms

        // Generate reschedule token and short link for client emails/SMS
        const rescheduleToken = generateApprovalToken('job', job.id, actualTenantId)
        const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(
          /\/$/,
          ''
        )
        const rescheduleFullUrl = `${publicAppUrl}/public/booking/${job.id}/reschedule?token=${rescheduleToken}`
        let smsRescheduleUrl: string | undefined
        if (wantsSms) {
          try {
            const { createShortLink } = await import('./shortLinks')
            smsRescheduleUrl = await createShortLink(rescheduleFullUrl)
          } catch (e) {
            console.warn('Could not create short link for reschedule SMS:', e)
          }
        }

        if (wantsEmail || wantsSms) {
          if (requireConfirmation) {
            if (wantsEmail) {
              console.log(`📧 Sending booking request email to ${clientEmail}`)
              const emailPayload = buildClientPendingEmail({
                clientName,
                serviceName: service.name,
                startTime,
                endTime,
                timezoneOffset,
                companyName,
                logoUrl,
                settings: {
                  companySupportEmail: settings?.companySupportEmail || null,
                  companyPhone: settings?.companyPhone || null,
                },
                jobId: job.id,
                rescheduleToken,
              })
              await sendEmail({
                ...emailPayload,
                to: clientEmail!,
                fromName: companyName,
                replyTo: replyToEmail,
              })
              console.log('✅ Booking request email sent successfully')
            }
            if (wantsSms) {
              console.log(`📱 Sending pending SMS to ${phoneForSms}`)
              const smsBody = buildBookingPendingSms({
                serviceName: service.name,
                startTime,
                companyName,
                timezoneOffset,
                rescheduleUrl: smsRescheduleUrl,
              })
              await sendSms(phoneForSms, smsBody)
            }
          } else {
            if (wantsEmail) {
              console.log(`📧 Sending instant confirmation email to ${clientEmail}`)
              const emailPayload = buildClientConfirmationEmail({
                clientName,
                serviceName: service.name,
                startTime,
                endTime,
                location: payload.location,
                timezoneOffset,
                companyName,
                logoUrl,
                settings: {
                  companySupportEmail: settings?.companySupportEmail || null,
                  companyPhone: settings?.companyPhone || null,
                },
                jobId: job.id,
                rescheduleToken,
              })
              await sendEmail({
                ...emailPayload,
                to: clientEmail!,
                fromName: companyName,
                replyTo: replyToEmail,
              })
              console.log('✅ Instant confirmation email sent successfully')
            }
            if (wantsSms) {
              console.log(`📱 Sending SMS to ${phoneForSms}`)
              const smsBody = buildBookingConfirmationSms({
                serviceName: service.name,
                startTime,
                companyName,
                timezoneOffset,
                rescheduleUrl: smsRescheduleUrl,
              })
              await sendSms(phoneForSms, smsBody)
            }
          }
        }

        // Send email to contractor if email is provided
        if (contractorEmail) {
          console.log(`📧 Sending contractor notification email to ${contractorEmail}`)
          const emailPayload = buildContractorNotificationEmail({
            contractorName: 'Contractor',
            serviceName: service.name,
            clientName,
            clientEmail: contact.email ?? undefined,
            clientPhone: contact.phone ?? undefined,
            startTime,
            endTime,
            location: payload.location,
            isPending: requireConfirmation,
            companyName,
            logoUrl,
            settings: {
              companySupportEmail: settings?.companySupportEmail || null,
              companyPhone: settings?.companyPhone || null,
            },
          })
          await sendEmail({
            ...emailPayload,
            to: contractorEmail,
            fromName: companyName,
            replyTo: replyToEmail,
          })
          console.log('✅ Contractor notification email sent successfully')
        }
      } catch (emailError) {
        // Log email errors but don't fail the booking
        console.error('❌ Failed to send booking emails:', emailError)
      }

      return job
    },
  },
  billing: {
    getStatus: async (tenantId: string) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeSubscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodEndsAt: true,
          cancelAtPeriodEnd: true,
          deleteAccountAtPeriodEnd: true,
          subscriptionTier: true,
        },
      })

      if (!tenant) {
        throw new ApiError('Tenant not found', 404)
      }

      const singlePriceId = process.env.STRIPE_PRICE_ID
      const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID
      const teamPlusPriceId = process.env.STRIPE_TEAM_PLUS_PRICE_ID
      const hasSubscription = !!tenant.stripeSubscriptionId
      const isTeamPrice = tenant.stripePriceId === teamPriceId || tenant.subscriptionTier === 'team'
      const isTeamPlusPrice =
        tenant.stripePriceId === teamPlusPriceId || tenant.subscriptionTier === 'team-plus'
      // Only report a paid tier when there's an active subscription; otherwise treat as no plan
      const subscriptionTier = hasSubscription
        ? tenant.subscriptionTier ||
          (isTeamPlusPrice ? 'team-plus' : isTeamPrice ? 'team' : 'single')
        : null

      let userCount = await prisma.user.count({ where: { tenantId } })
      const isTeamTier = subscriptionTier === 'team' || subscriptionTier === 'team-plus'
      // Sync cleanup: if single tier (or no subscription) but multiple users, remove non-owners
      if (!isTeamTier && userCount > 1) {
        try {
          await removeNonOwnerUsers(tenantId)
          userCount = 1
        } catch (err) {
          console.error('Failed to remove non-owner users during getStatus:', err)
        }
      }
      const teamMemberLimit =
        subscriptionTier === 'team' ? 5 : subscriptionTier === 'team-plus' ? null : null
      const canInviteMore = !teamMemberLimit || userCount < teamMemberLimit
      const canDowngradeToTeam = subscriptionTier === 'team-plus' && userCount <= 5
      const canDowngradeToSingle =
        (subscriptionTier === 'team' || subscriptionTier === 'team-plus') && userCount <= 1

      const canInviteTeamMembers = isTeamTier && hasSubscription

      return {
        hasSubscription,
        status: tenant.stripeSubscriptionStatus || 'none',
        trialEndsAt: tenant.trialEndsAt?.toISOString(),
        currentPeriodEndsAt: tenant.currentPeriodEndsAt?.toISOString(),
        cancelAtPeriodEnd: tenant.cancelAtPeriodEnd || false,
        deleteAccountAtPeriodEnd: tenant.deleteAccountAtPeriodEnd || false,
        subscriptionTier,
        canInviteTeamMembers,
        canInviteMore,
        teamMemberLimit,
        canDowngradeToTeam,
        canDowngradeToSingle,
        canDowngrade: canDowngradeToSingle || canDowngradeToTeam,
        teamMemberCount: userCount,
      }
    },
    createEmbeddedCheckoutSession: async (
      tenantId: string,
      userId: string,
      userEmail: string,
      options?: { priceId?: string; plan?: 'single' | 'team' | 'team-plus' }
    ) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
          name: true,
        },
      })

      if (!tenant) {
        throw new ApiError('Tenant not found', 404)
      }

      // Create or reuse Stripe customer
      let customerId = tenant.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            tenantId,
            ownerUserId: userId,
          },
        })
        customerId = customer.id

        // Save customer ID to tenant
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        })
      }

      let priceId = options?.priceId
      if (!priceId && options?.plan === 'team-plus') {
        priceId = process.env.STRIPE_TEAM_PLUS_PRICE_ID || undefined
      }
      if (!priceId && options?.plan === 'team') {
        priceId = process.env.STRIPE_TEAM_PRICE_ID || undefined
      }
      if (!priceId) {
        priceId = process.env.STRIPE_PRICE_ID || undefined
      }
      if (!priceId) {
        throw new ApiError('STRIPE_PRICE_ID not configured', 500)
      }

      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL}/app/billing/return?session_id={CHECKOUT_SESSION_ID}`
        : 'http://localhost:5173/app/billing/return?session_id={CHECKOUT_SESSION_ID}'

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        mode: 'subscription',
        customer: customerId,
        allow_promotion_codes: true,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 14,
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          metadata: {
            tenantId,
            ownerUserId: userId,
          },
        },
        payment_method_collection: 'always',
        return_url: returnUrl,
        metadata: {
          tenantId,
          ownerUserId: userId,
        },
      })

      return {
        clientSecret: session.client_secret,
      }
    },
    createCheckoutRedirectUrl: async (
      tenantId: string,
      userId: string,
      userEmail: string,
      options?: {
        plan?: 'single' | 'team' | 'team-plus'
        successUrl?: string
        cancelUrl?: string
      }
    ) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true, name: true },
      })

      if (!tenant) {
        throw new ApiError('Tenant not found', 404)
      }

      let customerId = tenant.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            tenantId,
            ownerUserId: userId,
          },
        })
        customerId = customer.id
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        })
      }

      let priceId =
        options?.plan === 'team-plus'
          ? process.env.STRIPE_TEAM_PLUS_PRICE_ID
          : options?.plan === 'team'
            ? process.env.STRIPE_TEAM_PRICE_ID
            : process.env.STRIPE_PRICE_ID
      if (!priceId) {
        throw new ApiError('STRIPE_PRICE_ID not configured', 500)
      }

      const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
      const defaultReturnUrl = `${baseUrl}/app/settings`
      const successUrl = options?.successUrl ?? `${defaultReturnUrl}?subscribed=1`
      const cancelUrl = options?.cancelUrl ?? `${defaultReturnUrl}?canceled=1`

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 14,
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          metadata: { tenantId, ownerUserId: userId },
        },
        payment_method_collection: 'always',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { tenantId, ownerUserId: userId },
      })

      return { url: session.url }
    },
    /** Creates Stripe Checkout for new signups (no tenant yet). User completes payment first, then creates account. */
    createSignupCheckoutSession: async (plan: 'single' | 'team' | 'team-plus') => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const priceId =
        plan === 'team-plus'
          ? process.env.STRIPE_TEAM_PLUS_PRICE_ID
          : plan === 'team'
            ? process.env.STRIPE_TEAM_PRICE_ID
            : process.env.STRIPE_PRICE_ID
      if (!priceId) {
        throw new ApiError('STRIPE_PRICE_ID not configured', 500)
      }

      const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
      const successUrl = `${baseUrl}/auth/signup/complete?session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${baseUrl}/auth/signup?canceled=1`

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 14,
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          metadata: { plan },
        },
        payment_method_collection: 'always',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { plan },
      })

      return { url: session.url }
    },
    getSignupSessionInfo: async (sessionId: string) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer'],
      })
      if (session.status !== 'complete' || !session.customer_details?.email) {
        throw new ApiError('Invalid or incomplete checkout session', 400)
      }
      const plan = (session.metadata?.plan as 'single' | 'team' | 'team-plus') || 'single'
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      return {
        email: session.customer_details.email,
        customerId: customerId || null,
        subscriptionId: subscriptionId || null,
        plan,
      }
    },
    createUpgradeCheckoutUrl: async (
      tenantId: string,
      userId: string,
      userEmail: string,
      plan: 'team' | 'team-plus'
    ) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true },
      })

      if (!tenant?.stripeCustomerId) {
        throw new ApiError('No Stripe customer found. Subscribe first.', 400)
      }

      const priceId =
        plan === 'team-plus'
          ? process.env.STRIPE_TEAM_PLUS_PRICE_ID
          : plan === 'team'
            ? process.env.STRIPE_TEAM_PRICE_ID
            : process.env.STRIPE_PRICE_ID
      if (!priceId) {
        throw new ApiError('Stripe price not configured for this plan', 500)
      }

      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL}/app/settings`
        : 'http://localhost:5173/app/settings'

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: tenant.stripeCustomerId,
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: { tenantId, ownerUserId: userId },
        },
        metadata: { tenantId, ownerUserId: userId },
        success_url: `${returnUrl}?upgraded=1`,
        cancel_url: returnUrl,
      })

      return { url: session.url }
    },
    createPortalSession: async (tenantId: string) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
        },
      })

      if (!tenant || !tenant.stripeCustomerId) {
        throw new ApiError('No Stripe customer found for this tenant', 404)
      }

      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL}/app/billing`
        : 'http://localhost:5173/app/billing'

      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: returnUrl,
      })

      return {
        url: session.url,
      }
    },
    cancelSubscription: async (tenantId: string, cancelAtPeriodEnd = true) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeSubscriptionId: true },
      })
      if (!tenant?.stripeSubscriptionId) {
        throw new ApiError('No active subscription to cancel', 400)
      }
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })
      if (cancelAtPeriodEnd) {
        await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
          cancel_at_period_end: true,
        })
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { cancelAtPeriodEnd: true },
        })
        return { cancelAtPeriodEnd: true }
      } else {
        await stripe.subscriptions.cancel(tenant.stripeSubscriptionId)
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            stripeSubscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            stripePriceId: null,
            subscriptionTier: null,
            cancelAtPeriodEnd: false,
          },
        })
        return { cancelAtPeriodEnd: false }
      }
    },
    cancelAndScheduleDeletion: async (tenantId: string) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeSubscriptionId: true, currentPeriodEndsAt: true },
      })
      if (!tenant?.stripeSubscriptionId) {
        throw new ApiError('No active subscription to cancel', 400)
      }
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })
      await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { cancelAtPeriodEnd: true, deleteAccountAtPeriodEnd: true },
      })
      return {
        cancelAtPeriodEnd: true,
        currentPeriodEndsAt: tenant.currentPeriodEndsAt?.toISOString() ?? null,
      }
    },
    handleWebhook: async (rawBody: string, signature: string) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        throw new ApiError('STRIPE_WEBHOOK_SECRET not configured', 500)
      }

      let event: any
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        throw new ApiError(`Webhook signature verification failed: ${err.message}`, 400)
      }

      // Check for idempotency
      const existingEvent = await prisma.stripeWebhookEvent.findUnique({
        where: { stripeEventId: event.id },
      })

      if (existingEvent) {
        console.log(`Event ${event.id} already processed, skipping`)
        return { received: true, alreadyProcessed: true }
      }

      // Map Stripe price ID to subscription tier
      const priceIdToTier = (priceId: string | null): string | null => {
        if (!priceId) return null
        const singlePriceId = process.env.STRIPE_PRICE_ID
        const soloPriceId = process.env.STRIPE_JOBDOCK_SOLO_PRICE_ID
        const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID
        const teamPriceIdAlt = process.env.STRIPE_JOBDOCK_TEAM_PRICE_ID
        const teamPlusPriceId = process.env.STRIPE_TEAM_PLUS_PRICE_ID
        const teamPlusPriceIdAlt = process.env.STRIPE_JOBDOCK_TEAM_PLUS_PRICE_ID
        if (priceId === singlePriceId || (soloPriceId && priceId === soloPriceId)) return 'single'
        if (priceId === teamPlusPriceId || (teamPlusPriceIdAlt && priceId === teamPlusPriceIdAlt))
          return 'team-plus'
        if (priceId === teamPriceId || (teamPriceIdAlt && priceId === teamPriceIdAlt)) return 'team'
        return 'single' // default for unknown price
      }

      // Process the event
      console.log(`Processing Stripe event: ${event.type}`)

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          const tenantId = session.metadata?.tenantId
          const plan = session.metadata?.plan as string | undefined

          if (tenantId && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string)
            const priceId = (sub.items?.data?.[0] as any)?.price?.id ?? process.env.STRIPE_PRICE_ID
            const subscriptionTier = priceIdToTier(priceId)
            await prisma.tenant.update({
              where: { id: tenantId },
              data: {
                stripeSubscriptionId: session.subscription as string,
                stripePriceId: priceId,
                subscriptionTier,
              },
            })
            console.log(
              `Updated tenant ${tenantId} with subscription ${session.subscription}, tier ${subscriptionTier}`
            )
          } else if (plan && session.customer_details?.email) {
            const baseUrl = (process.env.PUBLIC_APP_URL || 'https://app.thejobdock.com').replace(
              /\/$/,
              ''
            )
            const signupUrl = `${baseUrl}/auth/signup/complete?session_id=${session.id}`
            const payload = buildSignupCompleteEmail({
              to: session.customer_details.email,
              signupUrl,
            })
            await sendEmail(payload)
            console.log(`Sent signup completion email to ${session.customer_details.email}`)
          }
          break
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object
          const tenantId = subscription.metadata?.tenantId

          if (tenantId) {
            const priceId = (subscription.items?.data?.[0] as any)?.price?.id ?? null
            const subscriptionTier = priceIdToTier(priceId)
            const updateData: any = {
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionStatus: subscription.status,
              currentPeriodEndsAt: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              ...(priceId && { stripePriceId: priceId }),
              ...(subscriptionTier && { subscriptionTier }),
            }

            if (subscription.trial_end) {
              updateData.trialEndsAt = new Date(subscription.trial_end * 1000)
            }

            await prisma.tenant.update({
              where: { id: tenantId },
              data: updateData,
            })
            console.log(
              `Updated tenant ${tenantId} subscription status to ${subscription.status}, tier ${subscriptionTier}`
            )

            // When downgrading to Single, auto-remove all team members except the owner
            if (subscriptionTier === 'single') {
              await removeNonOwnerUsers(tenantId)
            }
          }
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          const tenantId = subscription.metadata?.tenantId

          if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
              where: { id: tenantId },
              select: { deleteAccountAtPeriodEnd: true },
            })
            if (tenant?.deleteAccountAtPeriodEnd) {
              console.log(`Executing scheduled account deletion for tenant ${tenantId}`)
              await executeAccountDeletion(tenantId)
            } else {
              await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                  stripeSubscriptionStatus: 'canceled',
                  stripeSubscriptionId: null,
                  stripePriceId: null,
                  subscriptionTier: null,
                  cancelAtPeriodEnd: false,
                },
              })
              console.log(`Subscription canceled for tenant ${tenantId}`)
            }
          }
          break
        }

        case 'invoice.paid': {
          const invoice = event.data.object
          // You can add additional logic here if needed
          console.log(`Invoice ${invoice.id} paid`)
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object
          // You can add logic to notify the user or take action
          console.log(`Invoice ${invoice.id} payment failed`)
          break
        }

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      // Record the event as processed
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeEventId: event.id,
        },
      })

      return { received: true }
    },
  },
  'job-logs': {
    getAll: async (
      tenantId: string,
      currentUserId?: string,
      currentUserRole?: string,
      canSeeOtherJobs?: boolean,
      options?: { includeArchived?: boolean; onlyArchived?: boolean }
    ) => {
      await ensureTenantExists(tenantId)
      const archivedFilter: Prisma.JobWhereInput = options?.onlyArchived
        ? { archivedAt: { not: null } }
        : options?.includeArchived
          ? {}
          : { archivedAt: null }
      const allJobs = await prisma.job.findMany({
        where: { tenantId, ...archivedFilter },
        include: {
          contact: true,
          createdBy: { select: { name: true } },
          service: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
          timeEntries: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { startTime: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })
      const jobs =
        currentUserId && canSeeOtherJobs !== true
          ? allJobs.filter(job => {
              if (job.createdById === currentUserId) return true
              const userIds = extractUserIds(job.assignedTo)
              return userIds.includes(currentUserId)
            })
          : allJobs
      const jobIds = jobs.map(j => j.id)
      const documents = await prisma.document.findMany({
        where: { tenantId, entityType: 'job', entityId: { in: jobIds } },
      })
      const photosByJobId = new Map<string, typeof documents>()
      for (const doc of documents) {
        const list = photosByJobId.get(doc.entityId) ?? []
        list.push(doc)
        photosByJobId.set(doc.entityId, list)
      }
      const apiBase = (process.env.API_BASE_URL || '').replace(/\/$/, '')
      return Promise.all(
        jobs.map(async job => {
          const docs = photosByJobId.get(job.id) ?? []
          const photos = apiBase
            ? docs.map(doc => ({
                id: doc.id,
                fileName: doc.fileName,
                fileKey: doc.fileKey,
                url: `${apiBase}/job-logs/${job.id}/photo-file?photoId=${doc.id}&token=${createPhotoToken(doc.id, job.id)}`,
                notes: doc.notes ?? null,
                markup: doc.markup ?? null,
                createdAt: doc.createdAt.toISOString(),
              }))
            : await Promise.all(
                docs.map(async doc => ({
                  id: doc.id,
                  fileName: doc.fileName,
                  fileKey: doc.fileKey,
                  url: await getFileUrl(doc.fileKey, 3600),
                  notes: doc.notes ?? null,
                  markup: doc.markup ?? null,
                  createdAt: doc.createdAt.toISOString(),
                }))
              )
          const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
          const assignedToUsers = await getAssignedToUsers(tenantId, job.assignedTo)
          const assignedToWithPrivacy = getAssignedToWithPrivacy(
            job.assignedTo,
            currentUserId,
            currentUserRole
          )
          const primaryBooking = job.bookings[0]
          return {
            ...job,
            pinnedAt: job.pinnedAt?.toISOString() ?? null,
            archivedAt: job.archivedAt?.toISOString() ?? null,
            assignedToName,
            assignedToUsers,
            assignedTo: assignedToWithPrivacy || job.assignedTo,
            // Flatten primary booking fields for Jobs page parity with calendar jobs
            startTime: primaryBooking?.startTime?.toISOString() ?? null,
            endTime: primaryBooking?.endTime?.toISOString() ?? null,
            toBeScheduled: primaryBooking ? (primaryBooking.toBeScheduled ?? false) : true,
            bookingStatus: primaryBooking?.status ?? null,
            serviceId: primaryBooking?.serviceId ?? (job as any).serviceId ?? null,
            serviceName: primaryBooking?.service?.name ?? (job as any).service?.name ?? null,
            price:
              primaryBooking?.price != null
                ? Number(primaryBooking.price)
                : (job as any).price != null
                  ? Number((job as any).price)
                  : null,
            job: primaryBooking
              ? {
                  id: job.id,
                  title: job.title,
                  startTime: primaryBooking.startTime?.toISOString(),
                  endTime: primaryBooking.endTime?.toISOString(),
                  status: primaryBooking.status,
                  createdByName: (job.createdBy as any)?.name,
                  serviceName: primaryBooking.service?.name ?? (job as any).service?.name ?? null,
                  price:
                    primaryBooking.price != null
                      ? Number(primaryBooking.price)
                      : (job as any).price != null
                        ? Number((job as any).price)
                        : null,
                  toBeScheduled: primaryBooking.toBeScheduled ?? false,
                }
              : {
                  id: job.id,
                  title: job.title,
                  startTime: undefined,
                  endTime: undefined,
                  status: job.status,
                  createdByName: (job.createdBy as any)?.name,
                },
            contact: job.contact
              ? {
                  id: job.contact.id,
                  name: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
                  email: job.contact.email,
                  phone: job.contact.phone,
                }
              : null,
            timeEntries: job.timeEntries.map((te: any) => ({
              id: te.id,
              startTime: te.startTime.toISOString(),
              endTime: te.endTime.toISOString(),
              breakMinutes: te.breakMinutes,
              notes: te.notes,
              userId: te.userId ?? undefined,
              userName: te.user?.name ?? undefined,
              hourlyRate: visibleHourlyRate(te, currentUserRole, currentUserId),
            })),
            photos,
          }
        })
      )
    },
    getById: async (
      tenantId: string,
      id: string,
      currentUserId?: string,
      currentUserRole?: string,
      canSeeOtherJobs?: boolean
    ) => {
      await ensureTenantExists(tenantId)
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          createdBy: { select: { name: true } },
          service: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
          timeEntries: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { startTime: 'desc' },
          },
        },
      })
      if (!job) throw new ApiError('Job not found', 404)
      if (currentUserId && canSeeOtherJobs !== true) {
        const canSee =
          job.createdById === currentUserId ||
          extractUserIds(job.assignedTo).includes(currentUserId)
        if (!canSee) throw new ApiError('Job not found', 404)
      }
      const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
      const assignedToUsers = await getAssignedToUsers(tenantId, job.assignedTo)
      const assignedToWithPrivacy = getAssignedToWithPrivacy(
        job.assignedTo,
        currentUserId,
        currentUserRole
      )
      const documents = await prisma.document.findMany({
        where: { tenantId, entityType: 'job', entityId: id },
      })
      const apiBase = (process.env.API_BASE_URL || '').replace(/\/$/, '')
      const photos = apiBase
        ? documents.map(doc => ({
            id: doc.id,
            fileName: doc.fileName,
            fileKey: doc.fileKey,
            url: `${apiBase}/job-logs/${id}/photo-file?photoId=${doc.id}&token=${createPhotoToken(doc.id, id)}`,
            notes: doc.notes ?? null,
            markup: doc.markup ?? null,
            createdAt: doc.createdAt.toISOString(),
          }))
        : await Promise.all(
            documents.map(async doc => ({
              id: doc.id,
              fileName: doc.fileName,
              fileKey: doc.fileKey,
              url: await getFileUrl(doc.fileKey, 3600),
              notes: doc.notes ?? null,
              markup: doc.markup ?? null,
              createdAt: doc.createdAt.toISOString(),
            }))
          )
      const primaryBooking = job.bookings[0]
      return {
        ...job,
        pinnedAt: job.pinnedAt?.toISOString() ?? null,
        archivedAt: job.archivedAt?.toISOString() ?? null,
        assignedToName,
        assignedToUsers,
        assignedTo: assignedToWithPrivacy || job.assignedTo,
        // Flatten primary booking fields for Jobs page parity with calendar jobs
        startTime: primaryBooking?.startTime?.toISOString() ?? null,
        endTime: primaryBooking?.endTime?.toISOString() ?? null,
        toBeScheduled: primaryBooking ? (primaryBooking.toBeScheduled ?? false) : true,
        bookingStatus: primaryBooking?.status ?? null,
        serviceName: primaryBooking?.service?.name ?? (job as any).service?.name ?? null,
        price:
          primaryBooking?.price != null
            ? Number(primaryBooking.price)
            : (job as any).price != null
              ? Number((job as any).price)
              : null,
        job: primaryBooking
          ? {
              id: job.id,
              title: job.title,
              startTime: primaryBooking.startTime?.toISOString(),
              endTime: primaryBooking.endTime?.toISOString(),
              status: primaryBooking.status,
              createdByName: (job.createdBy as any)?.name,
              serviceName: primaryBooking.service?.name ?? (job as any).service?.name ?? null,
              price:
                primaryBooking.price != null
                  ? Number(primaryBooking.price)
                  : (job as any).price != null
                    ? Number((job as any).price)
                    : null,
              toBeScheduled: primaryBooking.toBeScheduled ?? false,
            }
          : {
              id: job.id,
              title: job.title,
              startTime: undefined,
              endTime: undefined,
              status: job.status,
              createdByName: (job.createdBy as any)?.name,
            },
        contact: job.contact
          ? {
              id: job.contact.id,
              firstName: job.contact.firstName,
              lastName: job.contact.lastName,
              email: job.contact.email,
              phone: job.contact.phone,
              name: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            }
          : null,
        timeEntries: job.timeEntries.map((te: any) => ({
          id: te.id,
          startTime: te.startTime.toISOString(),
          endTime: te.endTime.toISOString(),
          breakMinutes: te.breakMinutes,
          notes: te.notes,
          hourlyRate: visibleHourlyRate(te, currentUserRole, currentUserId),
          createdAt: te.createdAt.toISOString(),
          updatedAt: te.updatedAt.toISOString(),
          userId: te.userId ?? undefined,
          userName: te.user?.name ?? undefined,
        })),
        photos,
        bookings: job.bookings.map((b: any) => ({
          id: b.id,
          startTime: b.startTime?.toISOString() ?? null,
          endTime: b.endTime?.toISOString() ?? null,
          status: b.status,
          toBeScheduled: b.toBeScheduled ?? false,
          service: b.service ? { name: b.service.name } : null,
          price: b.price != null ? Number(b.price) : null,
        })),
      }
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const normalizePrice = (v: any): number | null => {
        if (v === null || v === undefined || v === '') return null
        if (typeof v === 'number') return isNaN(v) ? null : v
        if (typeof v === 'string') {
          const n = parseFloat(v)
          return isNaN(n) ? null : n
        }
        return null
      }
      const normalizedAssignedTo = normalizeAssignedTo(payload.assignedTo)
      if (normalizedAssignedTo) await validateAssignedTo(tenantId, normalizedAssignedTo)
      const contactId = payload.contactId && payload.contactId.trim() ? payload.contactId : null
      if (!contactId) throw new ApiError('contactId is required', 400)
      const created = await prisma.job.create({
        data: {
          tenantId,
          title: payload.title,
          description: payload.description ?? null,
          contactId,
          serviceId: payload.serviceId ?? null,
          location: payload.location ?? null,
          price: normalizePrice(payload.price),
          notes: payload.notes ?? null,
          assignedTo: (normalizedAssignedTo ?? undefined) as unknown as Prisma.InputJsonValue,
          status: payload.status ?? 'active',
        },
        include: {
          contact: true,
          createdBy: { select: { name: true } },
          service: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
          timeEntries: true,
        },
      })

      if (normalizedAssignedTo && normalizedAssignedTo.length > 0) {
        const createdWithContact = created as {
          contact?: { firstName?: string; lastName?: string }
        }
        await sendAssignmentNotification({
          tenantId,
          assignedTo: normalizedAssignedTo,
          assignerUserId: payload._actingUserId,
          jobTitle: created.title,
          startTime: null,
          endTime: null,
          location: created.location ?? undefined,
          contactName: createdWithContact.contact
            ? `${createdWithContact.contact.firstName ?? ''} ${createdWithContact.contact.lastName ?? ''}`.trim() ||
              undefined
            : undefined,
          viewPath: '/app/job-logs',
        }).catch(e => console.error('Failed to send job assignment notification:', e))
      }
      const assignedUserIds = extractUserIds(created.assignedTo)
      const assignedUsers =
        assignedUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: assignedUserIds }, tenantId },
              select: { id: true, name: true },
            })
          : []
      const assignedToNames = assignedUsers
        .map(u => u.name)
        .filter(Boolean)
        .join(', ')
      return {
        ...created,
        pinnedAt: created.pinnedAt?.toISOString() ?? null,
        // flattened primary booking fields for Jobs page
        startTime: null,
        endTime: null,
        toBeScheduled: true,
        bookingStatus: null,
        serviceName: (created as any).service?.name ?? null,
        price: (created as any).price != null ? Number((created as any).price) : null,
        bookings: [],
        assignedToName: assignedToNames || undefined,
        assignedToUsers: assignedUsers,
      }
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const normalizePrice = (v: any): number | null => {
        if (v === null || v === undefined || v === '') return null
        if (typeof v === 'number') return isNaN(v) ? null : v
        if (typeof v === 'string') {
          const n = parseFloat(v)
          return isNaN(n) ? null : n
        }
        return null
      }
      const existing = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { bookings: { orderBy: { startTime: 'asc' } } },
      })
      if (!existing) throw new ApiError('Job not found', 404)
      const contactId =
        payload.contactId !== undefined
          ? payload.contactId && payload.contactId.trim()
            ? payload.contactId
            : null
          : undefined
      const normalizedAssignedTo =
        payload.assignedTo !== undefined ? normalizeAssignedTo(payload.assignedTo) : undefined
      if (normalizedAssignedTo !== undefined && normalizedAssignedTo)
        await validateAssignedTo(tenantId, normalizedAssignedTo)

      // Effective-date pay change: update time entries before updating job
      const effectiveDate = payload.effectiveDate ?? payload.payChangeEffectiveDate
      if (
        effectiveDate &&
        normalizedAssignedTo &&
        JSON.stringify(normalizedAssignedTo) !== JSON.stringify(existing.assignedTo)
      ) {
        await applyPayChangeEffectiveDate(
          tenantId,
          id,
          existing.assignedTo,
          normalizedAssignedTo,
          effectiveDate
        )
      }

      // Update primary booking fields (price/service) when provided
      const primaryBooking = existing.bookings[0]
      if (payload.price !== undefined || payload.serviceId !== undefined) {
        const bookingData: any = {}
        if (payload.price !== undefined) {
          bookingData.price = normalizePrice(payload.price)
        }
        if (payload.serviceId !== undefined) {
          bookingData.serviceId = payload.serviceId || null
        }
        if (Object.keys(bookingData).length > 0) {
          if (primaryBooking) {
            await prisma.booking.update({ where: { id: primaryBooking.id }, data: bookingData })
          }
        }
      }

      const pinUpdate =
        payload.pinned === true
          ? { pinnedAt: new Date() }
          : payload.pinned === false
            ? { pinnedAt: null }
            : {}

      const updated = await prisma.job.update({
        where: { id },
        data: {
          title: payload.title,
          description: payload.description ?? undefined,
          location: payload.location ?? undefined,
          notes: payload.notes ?? undefined,
          contactId,
          serviceId: payload.serviceId !== undefined ? payload.serviceId || null : undefined,
          price: payload.price !== undefined ? normalizePrice(payload.price) : undefined,
          assignedTo:
            payload.assignedTo !== undefined
              ? ((normalizedAssignedTo ?? null) as unknown as Prisma.InputJsonValue)
              : undefined,
          status: payload.status ?? undefined,
          ...pinUpdate,
        },
        include: {
          contact: true,
          service: true,
          bookings: { include: { service: true }, orderBy: { startTime: 'asc' } },
          timeEntries: true,
        },
      })
      const newAssignedTo =
        normalizedAssignedTo !== undefined
          ? normalizedAssignedTo
          : (existing.assignedTo as string[] | null)
      if (newAssignedTo && JSON.stringify(newAssignedTo) !== JSON.stringify(existing.assignedTo)) {
        // Only notify newly added members
        const oldUserIds = new Set(extractUserIds(existing.assignedTo))
        const newUserIds = extractUserIds(newAssignedTo)
        const newlyAddedUserIds = newUserIds.filter(id => !oldUserIds.has(id))

        if (newlyAddedUserIds.length > 0) {
          const b = (updated as { bookings: Array<{ startTime?: Date; endTime?: Date }> })
            .bookings[0]
          await sendAssignmentNotification({
            tenantId,
            assignedTo: newAssignedTo,
            assignerUserId: payload._actingUserId,
            jobTitle: updated.title,
            startTime: b?.startTime ?? null,
            endTime: b?.endTime ?? null,
            location: updated.location ?? undefined,
            contactName: (() => {
              const c = (updated as { contact?: { firstName?: string; lastName?: string } }).contact
              return c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || undefined : undefined
            })(),
            viewPath: '/app/job-logs',
            userIdsToNotify: newlyAddedUserIds,
          }).catch(e => console.error('Failed to send job assignment notification:', e))
        }
      }
      const assignedUserIds = extractUserIds(updated.assignedTo)
      const assignedUsers =
        assignedUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: assignedUserIds }, tenantId },
              select: { id: true, name: true },
            })
          : []
      const assignedToNames = assignedUsers
        .map(u => u.name)
        .filter(Boolean)
        .join(', ')
      const updatedPrimary = (updated as any).bookings?.[0]
      const uContact = (
        updated as {
          contact?: {
            id: string
            firstName: string
            lastName: string
            email?: string | null
            phone?: string | null
          } | null
        }
      ).contact
      return {
        ...updated,
        pinnedAt: updated.pinnedAt?.toISOString() ?? null,
        // Match getById contact shape (UI reads contact.name, not Prisma firstName/lastName)
        contact: uContact
          ? {
              id: uContact.id,
              firstName: uContact.firstName,
              lastName: uContact.lastName,
              email: uContact.email ?? undefined,
              phone: uContact.phone,
              name: `${uContact.firstName} ${uContact.lastName}`.trim(),
            }
          : null,
        // flattened primary booking fields for Jobs page parity with calendar jobs
        startTime: updatedPrimary?.startTime
          ? new Date(updatedPrimary.startTime).toISOString()
          : null,
        endTime: updatedPrimary?.endTime ? new Date(updatedPrimary.endTime).toISOString() : null,
        toBeScheduled: updatedPrimary ? (updatedPrimary.toBeScheduled ?? false) : true,
        bookingStatus: updatedPrimary?.status ?? null,
        serviceName: updatedPrimary?.service?.name ?? (updated as any).service?.name ?? null,
        price:
          updatedPrimary?.price != null
            ? Number(updatedPrimary.price)
            : (updated as any).price != null
              ? Number((updated as any).price)
              : null,
        bookings: Array.isArray((updated as any).bookings)
          ? (updated as any).bookings.map((b: any) => ({
              id: b.id,
              startTime:
                b.startTime?.toISOString?.() ??
                (b.startTime ? new Date(b.startTime).toISOString() : null),
              endTime:
                b.endTime?.toISOString?.() ??
                (b.endTime ? new Date(b.endTime).toISOString() : null),
              status: b.status,
              toBeScheduled: b.toBeScheduled ?? false,
              service: b.service ? { name: b.service.name } : null,
              price: b.price != null ? Number(b.price) : null,
            }))
          : undefined,
        assignedToName: assignedToNames || undefined,
        assignedToUsers: assignedUsers,
      }
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.job.findFirst({
        where: { id, tenantId },
      })
      if (!existing) throw new ApiError('Job not found', 404)
      const documents = await prisma.document.findMany({
        where: { tenantId, entityType: 'job', entityId: id },
      })
      for (const doc of documents) {
        try {
          await deleteFile(doc.fileKey)
        } catch (e) {
          console.error('Error deleting file:', e)
        }
      }
      await prisma.document.deleteMany({
        where: { tenantId, entityType: 'job', entityId: id },
      })
      await prisma.job.delete({ where: { id } })
      return { success: true }
    },
    getUploadUrl: async (
      tenantId: string,
      jobId: string,
      payload: { filename: string; contentType: string }
    ) => {
      await ensureTenantExists(tenantId)
      const job = await prisma.job.findFirst({
        where: { id: jobId, tenantId },
      })
      if (!job) throw new ApiError('Job not found', 404)
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
      if (!allowedTypes.includes(payload.contentType)) {
        throw new ApiError('Invalid file type. Only PNG, JPEG, JPG, and WebP are allowed.', 400)
      }
      const { randomUUID } = await import('crypto')
      // Sanitize the client-supplied extension so it can't inject path segments
      // (e.g. "photo.png/../../other") into the S3 key.
      const rawExt = (payload.filename?.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg'
      const key = `jobs/${tenantId}/${jobId}/${randomUUID()}.${ext}`
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
      const FILES_BUCKET = process.env.FILES_BUCKET || ''
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: FILES_BUCKET,
          Key: key,
          ContentType: payload.contentType,
        }),
        { expiresIn: 300 }
      )
      return { uploadUrl, key }
    },
    confirmUpload: async (
      tenantId: string,
      jobId: string,
      payload: {
        key: string
        fileName: string
        fileSize: number
        mimeType: string
        uploadedBy: string
      }
    ) => {
      await ensureTenantExists(tenantId)
      const job = await prisma.job.findFirst({
        where: { id: jobId, tenantId },
      })
      if (!job) throw new ApiError('Job not found', 404)
      // The key is supplied by the client after the presigned upload. It MUST live
      // under this tenant+job's prefix (the only place getUploadUrl will sign a PUT),
      // otherwise a tenant could register a Document row pointing at another tenant's
      // S3 object and read it back through the public photo proxy.
      const expectedPrefix = `jobs/${tenantId}/${jobId}/`
      if (typeof payload.key !== 'string' || !payload.key.startsWith(expectedPrefix)) {
        throw new ApiError('Invalid file key', 400)
      }
      const user = await prisma.user.findFirst({
        where: { tenantId },
        select: { id: true },
      })
      await prisma.document.create({
        data: {
          tenantId,
          fileName: payload.fileName,
          fileKey: payload.key,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
          entityType: 'job',
          entityId: jobId,
          uploadedBy: (payload.uploadedBy || user?.id) ?? 'system',
        },
      })
      return { success: true }
    },
    updatePhoto: async (
      tenantId: string,
      jobId: string,
      payload: { photoId: string; notes?: string; markup?: object }
    ) => {
      await ensureTenantExists(tenantId)
      const doc = await prisma.document.findFirst({
        where: {
          id: payload.photoId,
          tenantId,
          entityType: 'job',
          entityId: jobId,
        },
      })
      if (!doc) {
        throw new ApiError('Photo not found', 404)
      }
      await prisma.document.update({
        where: { id: payload.photoId },
        data: {
          ...(payload.notes !== undefined && { notes: payload.notes || null }),
          ...(payload.markup !== undefined && { markup: payload.markup as any }),
        },
      })
      return { success: true }
    },
    deletePhoto: async (tenantId: string, jobId: string, photoId: string) => {
      await ensureTenantExists(tenantId)
      const doc = await prisma.document.findFirst({
        where: {
          id: photoId,
          tenantId,
          entityType: 'job',
          entityId: jobId,
        },
      })
      if (!doc) throw new ApiError('Photo not found', 404)
      const deleteResult = await prisma.$transaction(async tx => {
        const res = await tx.document.deleteMany({
          where: {
            id: photoId,
            tenantId,
            entityType: 'job',
            entityId: jobId,
          },
        })
        return res
      })

      // If DB deletion didn't happen, treat as not found.
      if (!deleteResult.count) {
        throw new ApiError('Photo not found', 404)
      }

      // Best-effort storage cleanup after DB delete.
      try {
        await deleteFile(doc.fileKey)
      } catch (e) {
        console.error('Error deleting file from storage:', e)
      }

      return { success: true, deletedCount: deleteResult.count }
    },
  },
  'time-entries': {
    getAll: async (
      tenantId: string,
      jobId?: string,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const where: any = { tenantId }
      if (jobId) {
        where.jobId = jobId
      }

      // Check role-based permissions for employees (and all users with roles)
      // Admins/owners always have full access regardless of role assignment
      if (currentUserId && jobId) {
        const isAdminOrOwner = currentUserRole === 'admin' || currentUserRole === 'owner'

        // Admins/owners always see all entries - skip role checks
        if (!isAdminOrOwner) {
          const job = await prisma.job.findFirst({
            where: { id: jobId, tenantId },
            select: { assignedTo: true },
          })

          if (job) {
            const assignedTo = normalizeAssignedTo(job.assignedTo)
            const currentUserAssignment = assignedTo?.find((a: any) => a.userId === currentUserId)

            // Resolve role permissions for this job. Prefer roleId; fall back to matching by role title.
            const resolvedRole = currentUserAssignment?.roleId
              ? await prisma.jobRole.findFirst({
                  where: { id: currentUserAssignment.roleId, tenantId },
                })
              : currentUserAssignment?.role
                ? await prisma.jobRole.findFirst({
                    where: {
                      tenantId,
                      title: {
                        equals: currentUserAssignment.role.trim(),
                        mode: 'insensitive',
                      },
                    },
                  })
                : null

            if (resolvedRole) {
              const permissions = resolvedRole.permissions as any
              const canClockInFor = permissions?.canClockInFor || 'self'

              if (canClockInFor === 'self') {
                // Self-only: filter to own entries
                where.userId = currentUserId
              } else if (canClockInFor === 'assigned') {
                // Assigned: filter to assigned users' entries
                const assignedUserIds = assignedTo?.map((a: any) => a.userId).filter(Boolean) || []
                if (assignedUserIds.length > 0) {
                  where.userId = { in: assignedUserIds }
                } else {
                  // No assigned users, fall back to self
                  where.userId = currentUserId
                }
              }
              // 'everyone' allows all entries - no filter needed
            } else {
              // No resolvable role: employees fall back to self-only
              if (currentUserRole === 'employee') {
                where.userId = currentUserId
              }
            }
          } else if (currentUserRole === 'employee') {
            // Job not found and employee - fall back to self-only
            where.userId = currentUserId
          }
        }
        // Admins/owners see all entries - no filter needed
      } else if (currentUserRole === 'employee' && currentUserId) {
        // No jobId provided and employee - self-only
        where.userId = currentUserId
      }

      const entries = await prisma.timeEntry.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
      })
      return entries.map(te => ({
        ...te,
        startTime: te.startTime.toISOString(),
        endTime: te.endTime.toISOString(),
        userId: te.userId ?? undefined,
        userName: te.user?.name ?? undefined,
        hourlyRate: visibleHourlyRate(te, currentUserRole, currentUserId),
      }))
    },
    getById: async (
      tenantId: string,
      id: string,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const te = await prisma.timeEntry.findFirst({
        where: { id, tenantId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      if (!te) {
        throw new ApiError('Time entry not found', 404)
      }
      return {
        ...te,
        startTime: te.startTime.toISOString(),
        endTime: te.endTime.toISOString(),
        userId: te.userId ?? undefined,
        userName: te.user?.name ?? undefined,
        hourlyRate: visibleHourlyRate(te, currentUserRole, currentUserId),
      }
    },
    create: async (
      tenantId: string,
      payload: any,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const job = await prisma.job.findFirst({
        where: { id: payload.jobLogId, tenantId },
        select: { id: true, assignedTo: true },
      })
      if (!job) throw new ApiError('Job not found', 404)
      // Determine userId: use payload.userId if provided, otherwise use currentUserId
      let userId = payload.userId ?? currentUserId ?? null
      // Role-based clock-in permissions (admins/owners always have full access)
      const isAdminOrOwner = currentUserRole === 'admin' || currentUserRole === 'owner'

      // Debug logging to help diagnose permission issues
      console.log('[time-entries.create] Permission check:', {
        userId,
        currentUserId,
        currentUserRole,
        isAdminOrOwner,
        willCheckRolePermissions: userId !== currentUserId && !isAdminOrOwner,
      })

      // IMPORTANT: Check admin/owner status FIRST before doing any role-based permission checks
      // Admins/owners can clock in for anyone, regardless of their assignment or role on the job
      if (userId !== currentUserId && !isAdminOrOwner) {
        // Get current user's assignment on this job
        const assignedTo = normalizeAssignedTo(job.assignedTo)
        const currentUserAssignment = assignedTo?.find((a: any) => a.userId === currentUserId)

        // Resolve role permissions for this job. Prefer roleId; fall back to matching by role title.
        const resolvedRole = currentUserAssignment?.roleId
          ? await prisma.jobRole.findFirst({
              where: { id: currentUserAssignment.roleId, tenantId },
            })
          : currentUserAssignment?.role
            ? await prisma.jobRole.findFirst({
                where: {
                  tenantId,
                  title: {
                    equals: currentUserAssignment.role.trim(),
                    mode: 'insensitive',
                  },
                },
              })
            : null

        if (!resolvedRole) {
          // No resolvable role: can only create for self
          throw new ApiError('You can only clock in for yourself', 403)
        }

        const permissions = resolvedRole.permissions as any
        const canClockInFor = permissions?.canClockInFor || 'self'

        if (canClockInFor === 'self') {
          throw new ApiError('You can only clock in for yourself', 403)
        } else if (canClockInFor === 'assigned') {
          // Check if target userId is in the same job's assignedTo
          const targetUserAssigned = assignedTo?.some((a: any) => a.userId === userId)
          if (!targetUserAssigned) {
            throw new ApiError('You can only clock in for team members assigned to this job', 403)
          }
        }
        // 'everyone' allows any userId in tenant - no additional check needed
      }
      // Admins/owners can clock in for anyone - no permission check needed (handled by the condition above)
      // Validate userId exists if provided
      if (userId) {
        const user = await prisma.user.findFirst({
          where: { id: userId, tenantId },
        })
        if (!user) {
          throw new ApiError('User not found', 404)
        }
      }
      const created = await prisma.timeEntry.create({
        data: {
          tenantId,
          jobId: payload.jobLogId,
          userId,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
          breakMinutes: payload.breakMinutes ?? 0,
          notes: payload.notes ?? null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      return {
        ...created,
        startTime: created.startTime.toISOString(),
        endTime: created.endTime.toISOString(),
        userId: created.userId ?? undefined,
        userName: created.user?.name ?? undefined,
      }
    },
    update: async (
      tenantId: string,
      id: string,
      payload: any,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.timeEntry.findFirst({
        where: { id, tenantId },
        select: { id: true, jobId: true, userId: true },
      })
      if (!existing) {
        throw new ApiError('Time entry not found', 404)
      }

      // For employees, check role-based permissions
      if (currentUserRole === 'employee' && currentUserId) {
        // Load job and assignedTo
        const job = await prisma.job.findFirst({
          where: { id: existing.jobId, tenantId },
          select: { id: true, assignedTo: true },
        })

        if (!job) {
          throw new ApiError('Job not found', 404)
        }

        // Get current user's assignment on this job
        const assignedTo = normalizeAssignedTo(job.assignedTo)
        const currentUserAssignment = assignedTo?.find((a: any) => a.userId === currentUserId)

        // Check if user can edit this entry
        const entryUserId = existing.userId
        if (!entryUserId) {
          // Legacy entry without userId - only allow if user is admin/owner
          throw new ApiError('Cannot edit time entry without user assignment', 403)
        }

        if (!currentUserAssignment || !currentUserAssignment.roleId) {
          // No roleId (legacy): employees can only edit their own entries
          if (entryUserId !== currentUserId) {
            throw new ApiError('You can only edit your own time entries', 403)
          }
        } else {
          // Load JobRole to check permissions
          const jobRole = await prisma.jobRole.findFirst({
            where: { id: currentUserAssignment.roleId, tenantId },
          })

          if (!jobRole) {
            throw new ApiError('Job role not found', 404)
          }

          const permissions = jobRole.permissions as any
          const canEditTimeEntriesFor = permissions?.canEditTimeEntriesFor || 'self'

          if (canEditTimeEntriesFor === 'self') {
            if (entryUserId !== currentUserId) {
              throw new ApiError('You can only edit your own time entries', 403)
            }
          } else if (canEditTimeEntriesFor === 'assigned') {
            // Check if entry userId is in the same job's assignedTo
            const entryUserAssigned = assignedTo?.some((a: any) => a.userId === entryUserId)
            if (!entryUserAssigned) {
              throw new ApiError(
                'You can only edit time entries for team members assigned to this job',
                403
              )
            }
          }
          // 'everyone' allows editing any entry - no additional check needed
        }
      }

      // If the entry is being reassigned to a different user, that user must belong to this
      // tenant. (create validates this; update previously wrote payload.userId blindly, which
      // let a time entry be attributed to an arbitrary or cross-tenant user id.)
      if (
        payload.userId !== undefined &&
        payload.userId !== null &&
        payload.userId !== existing.userId
      ) {
        const targetUser = await prisma.user.findFirst({
          where: { id: payload.userId, tenantId },
          select: { id: true },
        })
        if (!targetUser) {
          throw new ApiError('User not found', 404)
        }
      }

      const updated = await prisma.timeEntry.update({
        where: { id },
        data: {
          startTime: payload.startTime ? new Date(payload.startTime) : undefined,
          endTime: payload.endTime ? new Date(payload.endTime) : undefined,
          breakMinutes: payload.breakMinutes ?? undefined,
          notes: payload.notes ?? undefined,
          userId: payload.userId !== undefined ? payload.userId : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      return {
        ...updated,
        startTime: updated.startTime.toISOString(),
        endTime: updated.endTime.toISOString(),
        userId: updated.userId ?? undefined,
        userName: updated.user?.name ?? undefined,
      }
    },
    delete: async (
      tenantId: string,
      id: string,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.timeEntry.findFirst({
        where: { id, tenantId },
        select: { id: true, jobId: true, userId: true },
      })
      if (!existing) {
        throw new ApiError('Time entry not found', 404)
      }

      // For employees, check role-based permissions (same logic as update)
      if (currentUserRole === 'employee' && currentUserId) {
        // Load job and assignedTo
        const job = await prisma.job.findFirst({
          where: { id: existing.jobId, tenantId },
          select: { id: true, assignedTo: true },
        })

        if (!job) {
          throw new ApiError('Job not found', 404)
        }

        // Get current user's assignment on this job
        const assignedTo = normalizeAssignedTo(job.assignedTo)
        const currentUserAssignment = assignedTo?.find((a: any) => a.userId === currentUserId)

        // Check if user can delete this entry
        const entryUserId = existing.userId
        if (!entryUserId) {
          // Legacy entry without userId - only allow if user is admin/owner
          throw new ApiError('Cannot delete time entry without user assignment', 403)
        }

        if (!currentUserAssignment || !currentUserAssignment.roleId) {
          // No roleId (legacy): employees can only delete their own entries
          if (entryUserId !== currentUserId) {
            throw new ApiError('You can only delete your own time entries', 403)
          }
        } else {
          // Load JobRole to check permissions
          const jobRole = await prisma.jobRole.findFirst({
            where: { id: currentUserAssignment.roleId, tenantId },
          })

          if (!jobRole) {
            throw new ApiError('Job role not found', 404)
          }

          const permissions = jobRole.permissions as any
          const canEditTimeEntriesFor = permissions?.canEditTimeEntriesFor || 'self'

          if (canEditTimeEntriesFor === 'self') {
            if (entryUserId !== currentUserId) {
              throw new ApiError('You can only delete your own time entries', 403)
            }
          } else if (canEditTimeEntriesFor === 'assigned') {
            // Check if entry userId is in the same job's assignedTo
            const entryUserAssigned = assignedTo?.some((a: any) => a.userId === entryUserId)
            if (!entryUserAssigned) {
              throw new ApiError(
                'You can only delete time entries for team members assigned to this job',
                403
              )
            }
          }
          // 'everyone' allows deleting any entry - no additional check needed
        }
      }

      await prisma.timeEntry.delete({ where: { id } })
      return { success: true }
    },
  },
  'job-roles': {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      const roles = await prisma.jobRole.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      })
      return roles.map(role => ({
        ...role,
        permissions: role.permissions as any,
      }))
    },
    getById: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const role = await prisma.jobRole.findFirst({
        where: { id, tenantId },
      })
      if (!role) {
        throw new ApiError('Job role not found', 404)
      }
      return {
        ...role,
        permissions: role.permissions as any,
      }
    },
    create: async (
      tenantId: string,
      payload: { title: string; permissions?: any; sortOrder?: number }
    ) => {
      await ensureTenantExists(tenantId)

      // Check if title already exists for this tenant
      const existing = await prisma.jobRole.findFirst({
        where: { tenantId, title: payload.title.trim() },
      })
      if (existing) {
        throw new ApiError('A job role with this title already exists', 400)
      }

      const created = await prisma.jobRole.create({
        data: {
          tenantId,
          title: payload.title.trim(),
          permissions: payload.permissions || null,
          sortOrder: payload.sortOrder ?? 0,
        },
      })
      return {
        ...created,
        permissions: created.permissions as any,
      }
    },
    update: async (
      tenantId: string,
      id: string,
      payload: { title?: string; permissions?: any; sortOrder?: number }
    ) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.jobRole.findFirst({
        where: { id, tenantId },
      })
      if (!existing) {
        throw new ApiError('Job role not found', 404)
      }

      // If title is being changed, check for conflicts
      if (payload.title && payload.title.trim() !== existing.title) {
        const conflict = await prisma.jobRole.findFirst({
          where: { tenantId, title: payload.title.trim(), id: { not: id } },
        })
        if (conflict) {
          throw new ApiError('A job role with this title already exists', 400)
        }
      }

      const updated = await prisma.jobRole.update({
        where: { id },
        data: {
          ...(payload.title !== undefined && { title: payload.title.trim() }),
          ...(payload.permissions !== undefined && { permissions: payload.permissions }),
          ...(payload.sortOrder !== undefined && { sortOrder: payload.sortOrder }),
        },
      })
      return {
        ...updated,
        permissions: updated.permissions as any,
      }
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const role = await prisma.jobRole.findFirst({
        where: { id, tenantId },
      })
      if (!role) {
        throw new ApiError('Job role not found', 404)
      }

      // Check if role is used in any job's assignedTo
      const jobs = await prisma.job.findMany({
        where: { tenantId },
        select: { assignedTo: true },
      })

      const bookings = await prisma.booking.findMany({
        where: { tenantId },
        select: { assignedTo: true },
      })

      const allAssignments = [
        ...jobs.map(j => j.assignedTo).filter(Boolean),
        ...bookings.map(b => b.assignedTo).filter(Boolean),
      ]

      for (const assignedTo of allAssignments) {
        if (!assignedTo) continue
        const normalized = normalizeAssignedTo(assignedTo)
        if (normalized) {
          const hasRoleId = normalized.some((a: any) => a.roleId === id)
          if (hasRoleId) {
            throw new ApiError(
              'Cannot delete job role that is assigned to jobs. Remove assignments first.',
              400
            )
          }
        }
      }

      await prisma.jobRole.delete({ where: { id } })
      return { success: true }
    },
  },
  'saved-line-items': {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      const items = await prisma.savedLineItem.findMany({
        where: { tenantId },
        orderBy: [{ name: 'asc' }],
      })
      return items.map(serializeSavedLineItem)
    },
    getById: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const item = await prisma.savedLineItem.findFirst({
        where: { id, tenantId },
      })
      if (!item) {
        throw new ApiError('Saved line item not found', 404)
      }
      return serializeSavedLineItem(item)
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const descriptionRaw =
        payload.description != null && payload.description !== ''
          ? String(payload.description).trim()
          : ''
      let name = String(payload.name || '').trim()
      if (!name) {
        name = descriptionRaw.slice(0, 500)
      }
      if (!name) {
        throw new ApiError('Description is required', 400)
      }
      const normalizedName = normalizeSavedLineItemName(name)
      const description = descriptionRaw
      const defaultQuantity =
        payload.defaultQuantity != null && payload.defaultQuantity !== ''
          ? Number(payload.defaultQuantity)
          : 1
      const unitPrice =
        payload.unitPrice != null && payload.unitPrice !== '' ? Number(payload.unitPrice) : 0
      if (!Number.isFinite(defaultQuantity) || defaultQuantity < 0) {
        throw new ApiError('Invalid default quantity', 400)
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new ApiError('Invalid unit price', 400)
      }

      const dup = await prisma.savedLineItem.findUnique({
        where: {
          tenantId_normalizedName: { tenantId, normalizedName },
        },
      })
      if (dup) {
        throw new ApiError('A saved line item with this name already exists', 400)
      }

      const created = await prisma.savedLineItem.create({
        data: {
          tenantId,
          name,
          normalizedName,
          description,
          defaultQuantity: new Prisma.Decimal(defaultQuantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          isActive: true,
        },
      })
      return serializeSavedLineItem(created)
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.savedLineItem.findFirst({
        where: { id, tenantId },
      })
      if (!existing) {
        throw new ApiError('Saved line item not found', 404)
      }

      let nextDescription: string | undefined
      if (payload.description !== undefined) {
        nextDescription = String(payload.description).trim()
      }

      let nextName: string | undefined
      let nextNormalized: string | undefined
      if (payload.name !== undefined) {
        nextName = String(payload.name).trim()
        if (!nextName) {
          throw new ApiError('Name cannot be empty', 400)
        }
      } else if (nextDescription !== undefined) {
        nextName = nextDescription.slice(0, 500)
        if (!nextName) {
          throw new ApiError('Description is required', 400)
        }
      }

      if (nextName !== undefined) {
        nextNormalized = normalizeSavedLineItemName(nextName)
        if (nextNormalized !== existing.normalizedName) {
          const taken = await prisma.savedLineItem.findFirst({
            where: { tenantId, normalizedName: nextNormalized, NOT: { id } },
          })
          if (taken) {
            throw new ApiError('A saved line item with this name already exists', 400)
          }
        }
      }

      const data: Prisma.SavedLineItemUpdateInput = {}
      if (nextName !== undefined && nextNormalized !== undefined) {
        data.name = nextName
        data.normalizedName = nextNormalized
      }
      if (nextDescription !== undefined) {
        data.description = nextDescription
      }
      if (payload.defaultQuantity !== undefined && payload.defaultQuantity !== '') {
        const q = Number(payload.defaultQuantity)
        if (!Number.isFinite(q) || q < 0) {
          throw new ApiError('Invalid default quantity', 400)
        }
        data.defaultQuantity = new Prisma.Decimal(q)
      }
      if (payload.unitPrice !== undefined && payload.unitPrice !== '') {
        const p = Number(payload.unitPrice)
        if (!Number.isFinite(p) || p < 0) {
          throw new ApiError('Invalid unit price', 400)
        }
        data.unitPrice = new Prisma.Decimal(p)
      }
      data.isActive = true

      const updated = await prisma.savedLineItem.update({
        where: { id },
        data,
      })
      return serializeSavedLineItem(updated)
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const item = await prisma.savedLineItem.findFirst({
        where: { id, tenantId },
      })
      if (!item) {
        throw new ApiError('Saved line item not found', 404)
      }
      await prisma.savedLineItem.delete({ where: { id } })
      return { success: true }
    },
    importPreview: async (tenantId: string, payload: { csvContent: string }) => {
      await ensureTenantExists(tenantId)
      return parseSavedLineItemCSVPreview(payload.csvContent)
    },
    importInit: async (
      tenantId: string,
      payload: { fileName: string; csvContent: string; fieldMapping: Record<string, string> }
    ) => {
      await ensureTenantExists(tenantId)
      const session = createSavedLineItemImportSession(
        tenantId,
        payload.fileName,
        payload.csvContent,
        payload.fieldMapping
      )
      return { sessionId: session.id }
    },
    importProcess: async (tenantId: string, sessionId: string) => {
      await ensureTenantExists(tenantId)
      const session = getSavedLineItemImportSession(sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      const data = await processSavedLineItemImportSession(sessionId)
      return serializeSavedLineItemImportResponse(data)
    },
    importStatus: async (tenantId: string, sessionId: string) => {
      await ensureTenantExists(tenantId)
      const session = getSavedLineItemImportSession(sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      return serializeSavedLineItemImportResponse(getSavedLineItemImportSessionData(sessionId))
    },
    importResolveConflict: async (
      tenantId: string,
      payload: {
        sessionId: string
        conflictId: string
        resolution: 'update' | 'skip' | 'keep_existing' | 'keep_incoming' | 'keep_both'
      }
    ) => {
      await ensureTenantExists(tenantId)
      const session = getSavedLineItemImportSession(payload.sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      await resolveSavedLineItemConflict(payload.sessionId, payload.conflictId, payload.resolution)
      return serializeSavedLineItemImportResponse(
        getSavedLineItemImportSessionData(payload.sessionId)
      )
    },
  },
  account: {
    deleteAccount: async (tenantId: string) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeSubscriptionId: true },
      })
      if (!tenant) {
        throw new ApiError('Tenant not found', 404)
      }
      if (tenant.stripeSubscriptionId) {
        try {
          const Stripe = (await import('stripe')).default
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2025-02-24.acacia',
          })
          await stripe.subscriptions.cancel(tenant.stripeSubscriptionId)
        } catch (stripeErr) {
          console.error('Failed to cancel Stripe subscription:', stripeErr)
        }
      }
      await executeAccountDeletion(tenantId)
      return { success: true }
    },
  },
  help: helpService,
  assistant: assistantChatService,
}

/** Remove all users except the owner (for Single-tier downgrade). Also deletes from Cognito. */
async function removeNonOwnerUsers(tenantId: string): Promise<void> {
  const { CognitoIdentityProviderClient, AdminDeleteUserCommand } =
    await import('@aws-sdk/client-cognito-identity-provider')
  const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
  })
  const USER_POOL_ID = process.env.USER_POOL_ID
  if (!USER_POOL_ID) {
    console.error('USER_POOL_ID not configured, skipping Cognito deletion')
  }
  const users = await prisma.user.findMany({
    where: { tenantId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  })
  const owner = users.find(u => u.role === 'owner') ?? users[0]
  if (!owner) return
  const toRemove = users.filter(u => u.id !== owner.id)
  for (const u of toRemove) {
    if (USER_POOL_ID) {
      try {
        await cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: u.email,
          })
        )
      } catch (cognitoErr: any) {
        if (cognitoErr?.name !== 'UserNotFoundException') {
          console.error(`Failed to delete Cognito user ${u.email}:`, cognitoErr)
        }
      }
    }
    await prisma.user.delete({ where: { id: u.id } })
    console.log(`Removed user ${u.id} (${u.email}) after downgrade to Single`)
  }
}

async function executeAccountDeletion(tenantId: string): Promise<void> {
  const { CognitoIdentityProviderClient, AdminDeleteUserCommand } =
    await import('@aws-sdk/client-cognito-identity-provider')
  const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
  })
  const USER_POOL_ID = process.env.USER_POOL_ID
  if (!USER_POOL_ID) {
    throw new ApiError('User pool not configured', 500)
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { users: { select: { email: true } } },
  })
  if (!tenant) return
  for (const { email } of tenant.users) {
    try {
      await cognitoClient.send(
        new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
        })
      )
    } catch (cognitoErr: any) {
      if (cognitoErr?.name === 'UserNotFoundException') {
        // User already deleted, continue
      } else {
        console.error(`Failed to delete Cognito user ${email}:`, cognitoErr)
        throw new ApiError(`Failed to delete user account: ${cognitoErr.message}`, 500)
      }
    }
  }
  await prisma.tenant.delete({ where: { id: tenantId } })
}
