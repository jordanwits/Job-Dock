import twilio from 'twilio'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || ''

let twilioClient: ReturnType<typeof twilio> | null = null
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  console.log('[OK] Twilio SMS client initialized')
} else {
  console.warn(
    `[WARN] Twilio not initialized. TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET'}, TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET'}`
  )
}

/**
 * Normalize phone number to E.164 format for Twilio.
 * Adds +1 for US numbers if missing.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return phone.startsWith('+') ? phone : `+${phone}`
}

/**
 * Check if Twilio SMS is configured and ready to send.
 */
export function isSmsConfigured(): boolean {
  return !!(twilioClient && TWILIO_PHONE_NUMBER)
}

/** GSM-7 single-segment limit (160 chars = 1 segment, lower cost) */
const SMS_SINGLE_SEGMENT_LIMIT = 160

/**
 * Truncate message to single segment when possible.
 * Skips truncation if body contains a URL (truncating would break the link).
 */
function truncateToSingleSegment(body: string): string {
  const trimmed = body.trim()
  if (trimmed.length <= SMS_SINGLE_SEGMENT_LIMIT) return trimmed
  if (/https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.slice(0, SMS_SINGLE_SEGMENT_LIMIT - 3) + '...'
}

/**
 * Send an SMS message via Twilio.
 * @param to - Recipient phone number (will be normalized to E.164)
 * @param body - Message body (kept to 160 chars when possible for single-segment)
 * @returns Message SID if sent, null if skipped or failed
 */
export async function sendSms(to: string, body: string): Promise<string | null> {
  if (!to || !body?.trim()) return null
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.warn('[WARN] Twilio SMS not configured, skipping send')
    return null
  }

  const bodyToSend = truncateToSingleSegment(body)

  try {
    const toNormalized = normalizePhone(to)
    const result = await twilioClient.messages.create({
      body: bodyToSend,
      from: TWILIO_PHONE_NUMBER,
      to: toNormalized,
    })
    console.log(`[OK] SMS sent to ${toNormalized} (SID: ${result.sid})`)
    return result.sid
  } catch (error) {
    console.error('[ERROR] Failed to send SMS:', error)
    return null
  }
}

/**
 * Build a short booking confirmation SMS.
 */
export function buildBookingConfirmationSms(params: {
  serviceName: string
  startTime: Date
  companyName: string
  timezoneOffset?: number
}): string {
  const { serviceName, startTime, companyName, timezoneOffset = -8 } = params
  const localHours = startTime.getUTCHours() + timezoneOffset
  const localMinutes = startTime.getUTCMinutes()
  const period = localHours >= 12 ? 'PM' : 'AM'
  const hour12 = ((localHours % 12) || 12).toString()
  const minStr = localMinutes.toString().padStart(2, '0')
  const timeStr = `${hour12}:${minStr} ${period}`
  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${companyName}: ${serviceName} confirmed for ${dateStr} at ${timeStr}.`
}

/**
 * Build a short booking pending (awaiting confirmation) SMS.
 */
export function buildBookingPendingSms(params: {
  serviceName: string
  startTime: Date
  companyName: string
  timezoneOffset?: number
}): string {
  const { serviceName, startTime, companyName, timezoneOffset = -8 } = params
  const localHours = startTime.getUTCHours() + timezoneOffset
  const localMinutes = startTime.getUTCMinutes()
  const period = localHours >= 12 ? 'PM' : 'AM'
  const hour12 = ((localHours % 12) || 12).toString()
  const minStr = localMinutes.toString().padStart(2, '0')
  const timeStr = `${hour12}:${minStr} ${period}`
  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${companyName}: ${serviceName} request for ${dateStr} at ${timeStr} pending. We'll confirm soon.`
}

/**
 * Build a short reschedule notification SMS.
 */
export function buildRescheduleNotificationSms(params: {
  serviceName: string
  startTime: Date
  companyName: string
  timezoneOffset?: number
}): string {
  const { serviceName, startTime, companyName, timezoneOffset = -8 } = params
  const localHours = startTime.getUTCHours() + timezoneOffset
  const localMinutes = startTime.getUTCMinutes()
  const period = localHours >= 12 ? 'PM' : 'AM'
  const hour12 = ((localHours % 12) || 12).toString()
  const minStr = localMinutes.toString().padStart(2, '0')
  const timeStr = `${hour12}:${minStr} ${period}`
  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${companyName}: Your ${serviceName} appointment has been rescheduled to ${dateStr} at ${timeStr}.`
}

/**
 * Build a short booking declined SMS.
 */
export function buildBookingDeclinedSms(params: {
  serviceName: string
  companyName: string
}): string {
  const { serviceName, companyName } = params
  return `${companyName}: ${serviceName} request couldn't be confirmed. Contact us to reschedule.`
}

/**
 * Build a short quote notification SMS.
 * Include viewUrl for the link to view/respond; omit for "Check email for details."
 */
export function buildQuoteNotificationSms(params: {
  quoteNumber: string
  companyName: string
  viewUrl?: string
}): string {
  const { companyName, viewUrl } = params
  if (viewUrl) {
    return `${companyName}: Your quote is ready. View: ${viewUrl}`
  }
  return `${companyName}: Your quote is ready. Check email for details.`
}

/**
 * Build a short invoice notification SMS.
 * Include viewUrl for the link to view/respond; omit for "Check email for details."
 */
export function buildInvoiceNotificationSms(params: {
  invoiceNumber: string
  companyName: string
  viewUrl?: string
}): string {
  const { companyName, viewUrl } = params
  if (viewUrl) {
    return `${companyName}: Your invoice is ready. View: ${viewUrl}`
  }
  return `${companyName}: Your invoice is ready. Check email for details.`
}

export type NotificationPreference = 'email' | 'sms' | 'both'

/**
 * Check if we should send email based on contact's notification preference.
 */
export function shouldSendEmail(preference?: NotificationPreference | string | null): boolean {
  return preference === 'email' || preference === 'both' || !preference
}

/**
 * Check if we should send SMS based on contact's notification preference.
 */
export function shouldSendSms(preference?: NotificationPreference | string | null): boolean {
  return preference === 'sms' || preference === 'both' || !preference
}
