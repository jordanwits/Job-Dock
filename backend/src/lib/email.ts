import { Resend } from 'resend'
import { generateQuotePDF, generateInvoicePDF } from './pdf'
import { generateApprovalToken } from './approvalTokens'
import { getFileUrl } from './fileUpload'

// Email configuration from environment variables
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console'
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@thejobdock.com'
const ENVIRONMENT = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev'

// Initialize Resend client if enabled
let resendClient: Resend | null = null
if (EMAIL_PROVIDER === 'resend' && RESEND_API_KEY) {
  resendClient = new Resend(RESEND_API_KEY)
  console.log('✅ Resend client initialized')
} else {
  console.warn(
    `⚠️ Resend not initialized. EMAIL_PROVIDER=${EMAIL_PROVIDER}, RESEND_API_KEY=${RESEND_API_KEY ? 'SET' : 'NOT SET'}`
  )
}

export interface EmailPayload {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  fromName?: string // Display name for FROM field (e.g., "John's Plumbing")
  replyTo?: string // Email address for replies
}

/**
 * Get local time components from a UTC date based on timezone offset
 * @param utcDate The UTC date
 * @param timezoneOffset Hours offset from UTC (e.g., -8 for PST, -5 for EST)
 * @returns Object with local time components
 */
function getLocalTimeComponents(utcDate: Date, timezoneOffset: number): {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
} {
  // Get UTC components
  const utcYear = utcDate.getUTCFullYear()
  const utcMonth = utcDate.getUTCMonth()
  const utcDay = utcDate.getUTCDate()
  const utcHours = utcDate.getUTCHours()
  const utcMinutes = utcDate.getUTCMinutes()
  const utcSeconds = utcDate.getUTCSeconds()
  
  // Calculate local time components
  let localHours = utcHours + timezoneOffset
  let localDay = utcDay
  let localMonth = utcMonth
  let localYear = utcYear
  
  // Handle day rollover
  if (localHours < 0) {
    localHours += 24
    localDay--
    if (localDay < 1) {
      localMonth--
      if (localMonth < 0) {
        localMonth = 11
        localYear--
      }
      localDay = new Date(Date.UTC(localYear, localMonth + 1, 0)).getUTCDate()
    }
  } else if (localHours >= 24) {
    localHours -= 24
    localDay++
    const daysInMonth = new Date(Date.UTC(localYear, localMonth + 1, 0)).getUTCDate()
    if (localDay > daysInMonth) {
      localDay = 1
      localMonth++
      if (localMonth > 11) {
        localMonth = 0
        localYear++
      }
    }
  }
  
  return {
    year: localYear,
    month: localMonth,
    day: localDay,
    hours: localHours,
    minutes: utcMinutes,
    seconds: utcSeconds,
  }
}

/**
 * Format time in 12-hour format with AM/PM
 */
function formatTime12Hour(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  const displayMinutes = minutes.toString().padStart(2, '0')
  return `${displayHours}:${displayMinutes} ${period}`
}

/**
 * Format date in long format (e.g., "Monday, February 19, 2026")
 */
function formatDateLong(year: number, month: number, day: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  // Create a date to get the day of week
  const date = new Date(Date.UTC(year, month, day))
  const dayOfWeek = dayNames[date.getUTCDay()]
  
  return `${dayOfWeek}, ${monthNames[month]} ${day}, ${year}`
}

export interface EmailWithAttachment {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  fromName?: string // Display name for FROM field
  replyTo?: string // Email address for replies
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
}

/**
 * Send an email using Resend or log to console in dev mode
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, htmlBody, textBody, fromName, replyTo } = payload

  // In production, do not silently "succeed" if Resend is selected but not configured.
  if (EMAIL_PROVIDER === 'resend' && !RESEND_API_KEY) {
    const msg = 'RESEND_API_KEY is not configured for EMAIL_PROVIDER=resend'
    if (ENVIRONMENT === 'prod' || ENVIRONMENT === 'production') {
      throw new Error(msg)
    }
    console.warn(`[WARNING] ${msg} (falling back to console output)`)
  }

  if (EMAIL_PROVIDER === 'resend' && resendClient) {
    // Send via Resend
    try {
      // Build FROM address with optional display name
      const fromAddress = fromName ? `${fromName} <${EMAIL_FROM_ADDRESS}>` : EMAIL_FROM_ADDRESS

      console.log(`📧 Attempting to send email via Resend to ${to}: ${subject}`)

      const result = await resendClient.emails.send({
        from: fromAddress,
        to,
        subject,
        html: htmlBody,
        ...(textBody && { text: textBody }),
        ...(replyTo && { reply_to: replyTo }),
      })

      const emailId =
        (result as any)?.data?.id ?? (result as any)?.id ?? (result as any)?.data ?? 'unknown'
      console.log(
        `✅ Email sent via Resend to ${to}: ${subject}${replyTo ? ` (Reply-To: ${replyTo})` : ''} (ID: ${emailId})`
      )
    } catch (error) {
      console.error('❌ Failed to send email via Resend:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        })
      }
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  } else {
    // Log to console in dev mode
    const warningMsg = EMAIL_PROVIDER === 'resend' && !RESEND_API_KEY
      ? '⚠️ WARNING: EMAIL_PROVIDER=resend but RESEND_API_KEY is missing! Email will NOT be sent.'
      : `📧 EMAIL (Dev Mode - ${EMAIL_PROVIDER === 'console' ? 'Console Mode' : 'Resend Not Configured'})`
    
    console.error('\n❌ =============== EMAIL NOT SENT ===============')
    console.error(warningMsg)
    console.error(`EMAIL_PROVIDER: ${EMAIL_PROVIDER}`)
    console.error(`RESEND_API_KEY: ${RESEND_API_KEY ? 'SET' : 'NOT SET'}`)
    console.error(`resendClient: ${resendClient ? 'INITIALIZED' : 'NULL'}`)
    console.error(`ENVIRONMENT: ${ENVIRONMENT}`)
    console.error(`To: ${to}`)
    console.error(`From: ${fromName ? `${fromName} <${EMAIL_FROM_ADDRESS}>` : EMAIL_FROM_ADDRESS}`)
    if (replyTo) console.error(`Reply-To: ${replyTo}`)
    console.error(`Subject: ${subject}`)
    console.error('---')
    console.error(textBody || htmlBody.replace(/<[^>]*>/g, ''))
    console.error('================================================\n')
    
    // In production, throw error instead of silently failing
    if ((ENVIRONMENT === 'prod' || ENVIRONMENT === 'production') && EMAIL_PROVIDER === 'resend' && !RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured. Emails cannot be sent in production.')
    }
  }
}

/**
 * Send an email with attachments using Resend
 */
export async function sendEmailWithAttachments(payload: EmailWithAttachment): Promise<void> {
  const { to, subject, htmlBody, textBody, fromName, replyTo, attachments = [] } = payload

  // In production, do not silently "succeed" if Resend is selected but not configured.
  if (EMAIL_PROVIDER === 'resend' && !RESEND_API_KEY) {
    const msg = 'RESEND_API_KEY is not configured for EMAIL_PROVIDER=resend'
    if (ENVIRONMENT === 'prod' || ENVIRONMENT === 'production') {
      throw new Error(msg)
    }
    console.warn(`[WARNING] ${msg} (falling back to console output)`)
  }

  if (EMAIL_PROVIDER === 'resend' && resendClient) {
    try {
      // Build FROM address with optional display name
      const fromAddress = fromName ? `${fromName} <${EMAIL_FROM_ADDRESS}>` : EMAIL_FROM_ADDRESS

      // Convert Buffer attachments to base64 strings for Resend
      const resendAttachments = attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
      }))

      await resendClient.emails.send({
        from: fromAddress,
        to,
        subject,
        html: htmlBody,
        ...(textBody && { text: textBody }),
        ...(replyTo && { reply_to: replyTo }),
        ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
      })

      console.log(
        `✅ Email with attachments sent via Resend to ${to}: ${subject}${replyTo ? ` (Reply-To: ${replyTo})` : ''}`
      )
    } catch (error) {
      console.error('❌ Failed to send email with attachments via Resend:', error)
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  } else {
    // Log to console in dev mode
    console.log('\n📧 =============== EMAIL WITH ATTACHMENTS (Dev Mode) ===============')
    console.log(`To: ${to}`)
    console.log(`From: ${fromName ? `${fromName} <${EMAIL_FROM_ADDRESS}>` : EMAIL_FROM_ADDRESS}`)
    if (replyTo) console.log(`Reply-To: ${replyTo}`)
    console.log(`Subject: ${subject}`)
    console.log(`Attachments: ${attachments.map(a => a.filename).join(', ')}`)
    console.log('---')
    console.log(textBody || htmlBody.replace(/<[^>]*>/g, ''))
    console.log('===============================================================\n')
  }
}

/**
 * Build modern email template wrapper with header and footer
 */
function buildModernEmailTemplate(data: {
  title: string
  content: string
  companyName?: string
  logoUrl?: string | null
  footerContent?: string
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): string {
  const { title, content, companyName = 'JobDock', logoUrl, footerContent, settings } = data

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #0B132B 0%, #1A1F36 100%); border-radius: 8px 8px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    ${logoUrl ? `
                      <img src="${logoUrl}" alt="${companyName}" style="max-height: 70px; max-width: 280px; display: block; margin: 0 auto;" />
                    ` : `
                      <h1 style="margin: 0; color: #D4AF37; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; text-align: center;">${companyName}</h1>
                    `}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #0B132B; font-size: 24px; font-weight: 600; line-height: 1.3;">${title}</h2>
              
              ${content}
              
              ${footerContent || ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              ${settings?.companySupportEmail || settings?.companyPhone ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${settings?.companySupportEmail ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Questions? Contact us at <a href="mailto:${settings.companySupportEmail}" style="color: #D4AF37; text-decoration: none;">${settings.companySupportEmail}</a>
                    </p>
                  </td>
                </tr>
                ` : ''}
                ${settings?.companyPhone ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Call us at <a href="tel:${settings.companyPhone}" style="color: #D4AF37; text-decoration: none;">${settings.companyPhone}</a>
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
              ` : ''}
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Email template: Client booking confirmation (instant)
 */
export function buildClientConfirmationEmail(data: {
  clientName: string
  serviceName: string
  startTime: Date
  endTime: Date
  location?: string
  tenantName?: string
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
  timezoneOffset?: number // Hours offset from UTC (e.g., -8 for PST, -5 for EST)
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, tenantName, breaks, timezoneOffset = -8, companyName, logoUrl, settings } = data

  // Get local time components
  const startLocal = getLocalTimeComponents(startTime, timezoneOffset)
  const endLocal = getLocalTimeComponents(endTime, timezoneOffset)

  // Detect if this is a multi-day job
  const durationMs = endTime.getTime() - startTime.getTime()
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  const dateStr = formatDateLong(startLocal.year, startLocal.month, startLocal.day)
  const endDateStr = formatDateLong(endLocal.year, endLocal.month, endLocal.day)
  const startTimeStr = formatTime12Hour(startLocal.hours, startLocal.minutes)
  const endTimeStr = formatTime12Hour(endLocal.hours, endLocal.minutes)

  const subject = `Your booking is confirmed - ${serviceName}`

  // Build breaks section if present
  let breaksHtml = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStartUTC = new Date(b.startTime)
        const bEndUTC = new Date(b.endTime)
        const bStartLocal = getLocalTimeComponents(bStartUTC, timezoneOffset)
        const bEndLocal = getLocalTimeComponents(bEndUTC, timezoneOffset)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `<li style="margin: 5px 0;">${formatDateLong(bStartLocal.year, bStartLocal.month, bStartLocal.day)} – ${formatDateLong(bEndLocal.year, bEndLocal.month, bEndLocal.day)}${reason}</li>`
        } else {
          return `<li style="margin: 5px 0;">${formatTime12Hour(bStartLocal.hours, bStartLocal.minutes)} – ${formatTime12Hour(bEndLocal.hours, bEndLocal.minutes)}${reason}</li>`
        }
      })
      .join('')
    breaksHtml = `
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 5px 0 10px 0;"><strong>📅 Schedule Notes:</strong></p>
        <p style="margin: 5px 0;">This job includes planned pauses:</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${breaksList}
        </ul>
        <p style="margin: 5px 0; font-size: 0.9em;">We'll return to work after each pause as scheduled.</p>
      </div>
    `
  }

  const displayCompanyName = companyName || tenantName || 'JobDock'
  
  // Build booking details card
  const bookingDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Service</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${serviceName}</p>
              </td>
            </tr>
            ${isMultiDay ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Duration</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr} through ${endDateStr}</p>
              </td>
            </tr>
            ` : `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Time</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${startTimeStr} - ${endTimeStr}</p>
              </td>
            </tr>
            `}
            ${location ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Location</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${location}</p>
              </td>
            </tr>
            ` : ''}
            ${tenantName ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Provider</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${tenantName}</p>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Your booking has been confirmed! Here are the details:</p>
    ${bookingDetailsCard}
    ${breaksHtml}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We look forward to seeing you!</p>
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">If you need to cancel or reschedule, please contact us as soon as possible.</p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: 'Booking Confirmed',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  // Build breaks section for text version
  let breaksText = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStartUTC = new Date(b.startTime)
        const bEndUTC = new Date(b.endTime)
        const bStartLocal = getLocalTimeComponents(bStartUTC, timezoneOffset)
        const bEndLocal = getLocalTimeComponents(bEndUTC, timezoneOffset)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `  - ${formatDateLong(bStartLocal.year, bStartLocal.month, bStartLocal.day)} – ${formatDateLong(bEndLocal.year, bEndLocal.month, bEndLocal.day)}${reason}`
        } else {
          return `  - ${formatTime12Hour(bStartLocal.hours, bStartLocal.minutes)} – ${formatTime12Hour(bEndLocal.hours, bEndLocal.minutes)}${reason}`
        }
      })
      .join('\n')
    breaksText = `

Schedule Notes:
This job includes planned pauses:
${breaksList}
We'll return to work after each pause as scheduled.`
  }

  const textBody = `
Booking Confirmed

Hi ${clientName},

Your booking has been confirmed! Here are the details:

Service: ${serviceName}
${
  isMultiDay
    ? `Duration: ${dateStr} through ${endDateStr}`
    : `Date: ${dateStr}
Time: ${startTimeStr} - ${endTimeStr}`
}
${location ? `Location: ${location}` : ''}
${tenantName ? `Provider: ${tenantName}` : ''}
${breaksText}

We look forward to seeing you!

If you need to cancel or reschedule, please contact us as soon as possible.
  `.trim()

  return {
    to: '', // Will be set by caller with actual email address
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Email template: Client booking pending confirmation
 */
export function buildClientPendingEmail(data: {
  clientName: string
  serviceName: string
  startTime: Date
  endTime: Date
  timezoneOffset?: number // Hours offset from UTC (e.g., -8 for PST, -5 for EST)
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, timezoneOffset = -8, companyName, logoUrl, settings } = data

  // Get local time components
  const startLocal = getLocalTimeComponents(startTime, timezoneOffset)

  const dateStr = formatDateLong(startLocal.year, startLocal.month, startLocal.day)
  const startTimeStr = formatTime12Hour(startLocal.hours, startLocal.minutes)

  const bookingId = `#${Date.now().toString().slice(-6)}`
  const subject = `Booking request received ${bookingId} - ${serviceName}`

  const displayCompanyName = companyName || 'JobDock'
  
  const bookingDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Service</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${serviceName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Time</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${startTimeStr}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">We've received your booking request for:</p>
    ${bookingDetailsCard}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">Your request is pending confirmation. We'll send you another email once it's confirmed.</p>
    <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">Thank you for your patience!</p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: 'Booking Request Received',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Booking Request Received

Hi ${clientName},

We've received your booking request for:

Service: ${serviceName}
Date: ${dateStr}
Time: ${startTimeStr}

Your request is pending confirmation. We'll send you another email once it's confirmed.

Thank you for your patience!
  `.trim()

  return {
    to: data.clientName, // This should be client email
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Email template: Contractor new booking notification
 */
export function buildContractorNotificationEmail(data: {
  contractorName: string
  serviceName: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  startTime: Date
  endTime: Date
  location?: string
  isPending: boolean
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const {
    contractorName,
    serviceName,
    clientName,
    clientEmail,
    clientPhone,
    startTime,
    endTime,
    location,
    isPending,
    companyName,
    logoUrl,
    settings,
  } = data

  // Get local time components (using default timezone offset)
  const startLocal = getLocalTimeComponents(startTime, -8)
  const endLocal = getLocalTimeComponents(endTime, -8)
  const dateStr = formatDateLong(startLocal.year, startLocal.month, startLocal.day)
  const startTimeStr = formatTime12Hour(startLocal.hours, startLocal.minutes)
  const endTimeStr = formatTime12Hour(endLocal.hours, endLocal.minutes)

  const subject = isPending
    ? `New booking request for ${serviceName}`
    : `New booking for ${serviceName}`

  const displayCompanyName = companyName || 'JobDock'
  const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
  
  const bookingDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${clientName}</p>
              </td>
            </tr>
            ${clientEmail ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Email</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;"><a href="mailto:${clientEmail}" style="color: #D4AF37; text-decoration: none;">${clientEmail}</a></p>
              </td>
            </tr>
            ` : ''}
            ${clientPhone ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Phone</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;"><a href="tel:${clientPhone}" style="color: #D4AF37; text-decoration: none;">${clientPhone}</a></p>
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Service</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${serviceName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Time</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${startTimeStr} - ${endTimeStr}</p>
              </td>
            </tr>
            ${location ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Location</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${location}</p>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
  `
  
  const actionButton = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #D4AF37; border-radius: 6px;">
                <a href="${publicAppUrl}/scheduling" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View in Dashboard</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${contractorName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">You have a new booking${isPending ? ' request' : ''} for <strong>${serviceName}</strong>.</p>
    ${bookingDetailsCard}
    ${isPending ? '<p style="margin: 20px 0 0 0; color: #dc3545; font-size: 16px; font-weight: 600; line-height: 1.6;">⚠️ This booking requires your confirmation. Please log in to your dashboard to confirm or decline.</p>' : '<p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">This booking has been automatically confirmed.</p>'}
    ${actionButton}
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: isPending ? 'New Booking Request' : 'New Booking',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
${isPending ? 'New Booking Request' : 'New Booking'}

Hi ${contractorName},

You have a new booking${isPending ? ' request' : ''} for ${serviceName}.

Client: ${clientName}
${clientEmail ? `Email: ${clientEmail}` : ''}
${clientPhone ? `Phone: ${clientPhone}` : ''}
Service: ${serviceName}
Date: ${dateStr}
Time: ${startTimeStr} - ${endTimeStr}
${location ? `Location: ${location}` : ''}

${isPending ? '⚠️ This booking requires your confirmation. Please log in to your dashboard to confirm or decline.' : 'This booking has been automatically confirmed.'}

View in Dashboard: ${process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'}/scheduling
  `.trim()

  return {
    to: data.contractorName, // This should be contractor email
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Email template: Job assignment notification (to assigned team member)
 */
export function buildJobAssignmentNotificationEmail(data: {
  assigneeName: string
  assigneeEmail: string
  assignerName: string
  jobTitle: string
  startTime: Date | null
  endTime: Date | null
  location?: string
  contactName?: string
  viewPath?: string // e.g. '/app/scheduling' or '/app/job-logs'
  fromName?: string // Display name for Outlook deliverability
  replyTo?: string
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { assigneeName, assigneeEmail, assignerName, jobTitle, startTime, endTime, location, contactName, viewPath = '/app/scheduling', fromName, replyTo, companyName, logoUrl, settings } = data

  const dateStr = startTime
    ? (() => {
        const local = getLocalTimeComponents(startTime, -8)
        return formatDateLong(local.year, local.month, local.day)
      })()
    : 'To be scheduled'
  const timeStr =
    startTime && endTime
      ? (() => {
          const startLocal = getLocalTimeComponents(startTime, -8)
          const endLocal = getLocalTimeComponents(endTime, -8)
          return `${formatTime12Hour(startLocal.hours, startLocal.minutes)} - ${formatTime12Hour(endLocal.hours, endLocal.minutes)}`
        })()
      : ''

  const subject = `You've been assigned: ${jobTitle}`

  const displayCompanyName = companyName || fromName || 'JobDock'
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.thejobdock.com').replace(/\/$/, '')
  
  const jobDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Job</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${jobTitle}</p>
              </td>
            </tr>
            ${contactName ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Contact</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${contactName}</p>
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            ${timeStr ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Time</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${timeStr}</p>
              </td>
            </tr>
            ` : ''}
            ${location ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Location</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${location}</p>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
  `
  
  const actionButton = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #D4AF37; border-radius: 6px;">
                <a href="${publicAppUrl}${viewPath}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View in Dashboard</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${assigneeName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;"><strong>${assignerName}</strong> has assigned you to a job.</p>
    ${jobDetailsCard}
    ${actionButton}
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: 'Job Assignment',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Job Assignment

Hi ${assigneeName},

${assignerName} has assigned you to a job.

Job: ${jobTitle}
${contactName ? `Contact: ${contactName}\n` : ''}Date: ${dateStr}
${timeStr ? `Time: ${timeStr}\n` : ''}${location ? `Location: ${location}\n` : ''}

View in Dashboard: ${(process.env.PUBLIC_APP_URL || 'https://app.thejobdock.com').replace(/\/$/, '')}${viewPath}
  `.trim()

  return {
    to: assigneeEmail,
    subject,
    htmlBody,
    textBody,
    fromName,
    replyTo,
  }
}

/**
 * Email template: Client booking confirmed (after pending)
 */
export function buildClientBookingConfirmedEmail(data: {
  clientName: string
  serviceName: string
  startTime: Date
  endTime: Date
  location?: string
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
  timezoneOffset?: number // Hours offset from UTC (e.g., -8 for PST, -5 for EST)
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, breaks, timezoneOffset = -8, companyName, logoUrl, settings } = data

  // Get local time components
  const startLocal = getLocalTimeComponents(startTime, timezoneOffset)
  const endLocal = getLocalTimeComponents(endTime, timezoneOffset)

  // Detect if this is a multi-day job
  const durationMs = endTime.getTime() - startTime.getTime()
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  const dateStr = formatDateLong(startLocal.year, startLocal.month, startLocal.day)
  const endDateStr = formatDateLong(endLocal.year, endLocal.month, endLocal.day)
  const startTimeStr = formatTime12Hour(startLocal.hours, startLocal.minutes)
  const endTimeStr = formatTime12Hour(endLocal.hours, endLocal.minutes)

  const bookingId = `#${Date.now().toString().slice(-6)}`
  const subject = `Your booking has been confirmed ${bookingId} - ${serviceName}`

  // Build breaks section if present
  let breaksHtml = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStartUTC = new Date(b.startTime)
        const bEndUTC = new Date(b.endTime)
        const bStartLocal = getLocalTimeComponents(bStartUTC, timezoneOffset)
        const bEndLocal = getLocalTimeComponents(bEndUTC, timezoneOffset)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `<li style="margin: 5px 0;">${formatDateLong(bStartLocal.year, bStartLocal.month, bStartLocal.day)} – ${formatDateLong(bEndLocal.year, bEndLocal.month, bEndLocal.day)}${reason}</li>`
        } else {
          return `<li style="margin: 5px 0;">${formatTime12Hour(bStartLocal.hours, bStartLocal.minutes)} – ${formatTime12Hour(bEndLocal.hours, bEndLocal.minutes)}${reason}</li>`
        }
      })
      .join('')
    breaksHtml = `
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 5px 0 10px 0;"><strong>📅 Schedule Notes:</strong></p>
        <p style="margin: 5px 0;">This job includes planned pauses:</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${breaksList}
        </ul>
        <p style="margin: 5px 0; font-size: 0.9em;">We'll return to work after each pause as scheduled.</p>
      </div>
    `
  }

  const displayCompanyName = companyName || 'JobDock'
  
  const bookingDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Service</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${serviceName}</p>
              </td>
            </tr>
            ${isMultiDay ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Duration</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr} through ${endDateStr}</p>
              </td>
            </tr>
            ` : `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Time</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${startTimeStr} - ${endTimeStr}</p>
              </td>
            </tr>
            `}
            ${location ? `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Location</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${location}</p>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Great news! Your booking request has been confirmed.</p>
    ${bookingDetailsCard}
    ${breaksHtml}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We look forward to seeing you!</p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: '✓ Booking Confirmed',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  // Build breaks section for text version
  let breaksText = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStartUTC = new Date(b.startTime)
        const bEndUTC = new Date(b.endTime)
        const bStartLocal = getLocalTimeComponents(bStartUTC, timezoneOffset)
        const bEndLocal = getLocalTimeComponents(bEndUTC, timezoneOffset)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `  - ${formatDateLong(bStartLocal.year, bStartLocal.month, bStartLocal.day)} – ${formatDateLong(bEndLocal.year, bEndLocal.month, bEndLocal.day)}${reason}`
        } else {
          return `  - ${formatTime12Hour(bStartLocal.hours, bStartLocal.minutes)} – ${formatTime12Hour(bEndLocal.hours, bEndLocal.minutes)}${reason}`
        }
      })
      .join('\n')
    breaksText = `

Schedule Notes:
This job includes planned pauses:
${breaksList}
We'll return to work after each pause as scheduled.`
  }

  const textBody = `
✓ Booking Confirmed

Hi ${clientName},

Great news! Your booking request has been confirmed.

Service: ${serviceName}
${
  isMultiDay
    ? `Duration: ${dateStr} through ${endDateStr}`
    : `Date: ${dateStr}
Time: ${startTimeStr} - ${endTimeStr}`
}
${location ? `Location: ${location}` : ''}
${breaksText}

We look forward to seeing you!
  `.trim()

  return {
    to: data.clientName, // This should be client email
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Email template: Client booking declined
 */
export function buildClientBookingDeclinedEmail(data: {
  clientName: string
  serviceName: string
  startTime: Date
  reason?: string
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { clientName, serviceName, startTime, reason, companyName, logoUrl, settings } = data

  // Get local time components (using default timezone offset)
  const startLocal = getLocalTimeComponents(startTime, -8)
  const dateStr = formatDateLong(startLocal.year, startLocal.month, startLocal.day)
  const startTimeStr = formatTime12Hour(startLocal.hours, startLocal.minutes)

  const subject = `Booking request declined - ${serviceName}`

  const displayCompanyName = companyName || 'JobDock'
  
  const bookingDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Service</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${serviceName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Time</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${startTimeStr}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Unfortunately, we're unable to accommodate your booking request for:</p>
    ${bookingDetailsCard}
    ${reason ? `<p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;"><strong>Reason:</strong> ${reason}</p>` : ''}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We apologize for any inconvenience. Please feel free to contact us if you'd like to reschedule or have any questions.</p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: 'Booking Request Declined',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Booking Request Declined

Hi ${clientName},

Unfortunately, we're unable to accommodate your booking request for:

Service: ${serviceName}
Date: ${dateStr}
Time: ${startTimeStr}

${reason ? `Reason: ${reason}` : ''}

We apologize for any inconvenience. Please feel free to contact us if you'd like to reschedule or have any questions.
  `.trim()

  return {
    to: data.clientName, // This should be client email
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Build and send quote email with PDF attachment
 */
export async function sendQuoteEmail(data: {
  quoteData: any
  tenantName?: string
  tenantId: string
}): Promise<void> {
  const { quoteData, tenantName, tenantId } = data

  const clientEmail = quoteData.contactEmail
  if (!clientEmail) {
    throw new Error('Contact does not have an email address')
  }

  const clientName = quoteData.contactName || 'Valued Customer'

  // Get custom email template from settings
  const prisma = (await import('./db')).default
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  })

  // Use custom template or default
  let subject = settings?.quoteEmailSubject || `Quote {{quote_number}} from {{company_name}}`
  let bodyTemplate =
    settings?.quoteEmailBody ||
    `Hi {{customer_name}},\n\nPlease find attached quote {{quote_number}}.\n\nWe look forward to working with you!`

  // Replace template variables
  const companyName = settings?.companyDisplayName || tenantName || 'JobDock'
  subject = subject
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{quote_number\}\}/g, quoteData.quoteNumber)
    .replace(/\{\{customer_name\}\}/g, clientName)

  bodyTemplate = bodyTemplate
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{quote_number\}\}/g, quoteData.quoteNumber)
    .replace(/\{\{customer_name\}\}/g, clientName)

  const validUntilText = quoteData.validUntil
    ? new Date(quoteData.validUntil).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A'

  // Convert body template newlines to HTML
  const bodyHtml = bodyTemplate
    .split('\n')
    .map(line => `<p>${line}</p>`)
    .join('')

  // Generate approval token and URLs
  const approvalToken = generateApprovalToken('quote', quoteData.id, tenantId)
  const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
  const acceptUrl = `${publicAppUrl}/public/quote/${quoteData.id}/accept?token=${approvalToken}`
  const declineUrl = `${publicAppUrl}/public/quote/${quoteData.id}/decline?token=${approvalToken}`

  // Fetch logo URL if available (7 days expiration for email)
  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
    } catch (error) {
      console.error('Error fetching logo URL for email:', error)
    }
  }

  // Build modern HTML email template
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Quote</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #0B132B 0%, #1A1F36 100%); border-radius: 8px 8px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    ${logoUrl ? `
                      <img src="${logoUrl}" alt="${companyName}" style="max-height: 70px; max-width: 280px; display: block; margin: 0 auto;" />
                    ` : `
                      <h1 style="margin: 0; color: #D4AF37; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; text-align: center;">${companyName}</h1>
                    `}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #0B132B; font-size: 24px; font-weight: 600; line-height: 1.3;">New Quote</h2>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
              
              ${bodyHtml}
              
              <!-- Quote Details Card -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Quote Number</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${quoteData.quoteNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Total Amount</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 24px; font-weight: 700; line-height: 1.4; color: #D4AF37;">$${quoteData.total.toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Valid Until</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${validUntilText}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Action Buttons -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0 0 20px 0;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; font-weight: 500; line-height: 1.5;">Please review and respond to this quote:</p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding: 0 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #D4AF37; border-radius: 6px;">
                                <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Accept Quote</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" style="padding: 0 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #6c757d; border-radius: 6px;">
                                <a href="${declineUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Decline Quote</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We look forward to working with you!</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              ${settings?.companySupportEmail || settings?.companyPhone ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${settings?.companySupportEmail ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Questions? Contact us at <a href="mailto:${settings.companySupportEmail}" style="color: #D4AF37; text-decoration: none;">${settings.companySupportEmail}</a>
                    </p>
                  </td>
                </tr>
                ` : ''}
                ${settings?.companyPhone ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Call us at <a href="tel:${settings.companyPhone}" style="color: #D4AF37; text-decoration: none;">${settings.companyPhone}</a>
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
              ` : ''}
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  const textBody = `
New Quote

Hi ${clientName},

Please find your quote attached as a PDF document.

Quote Number: ${quoteData.quoteNumber}
Total Amount: $${quoteData.total.toFixed(2)}
Valid Until: ${validUntilText}

**PLEASE RESPOND TO THIS QUOTE:**

Accept Quote: ${acceptUrl}

Decline Quote: ${declineUrl}

Please review the attached quote and let us know if you have any questions.

We look forward to working with you!

This quote is valid until ${validUntilText}. Please contact us if you would like to proceed.
  `.trim()

  // Generate PDF with company info
  const pdfBuffer = await generateQuotePDF(quoteData, tenantName, {
    name: companyName,
    email: settings?.companySupportEmail || undefined,
    phone: settings?.companyPhone || undefined,
    logoKey: settings?.logoUrl || undefined,
    templateKey: settings?.quotePdfTemplateKey || undefined,
  })

  // Send email with PDF attachment
  await sendEmailWithAttachments({
    to: clientEmail,
    subject,
    htmlBody,
    textBody,
    fromName: companyName,
    replyTo: settings?.companySupportEmail || undefined,
    attachments: [
      {
        filename: `Quote-${quoteData.quoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

/**
 * Email template: Early access request notification (to admin)
 */
export function buildEarlyAccessRequestEmail(data: { 
  name: string
  email: string
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { name, email, companyName, logoUrl, settings } = data

  const subject = `New Early Access Request from ${name}`

  const displayCompanyName = companyName || 'JobDock'
  
  const requestDetailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Name</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${name}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Email</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;"><a href="mailto:${email}" style="color: #D4AF37; text-decoration: none;">${email}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Someone has requested early access to JobDock:</p>
    ${requestDetailsCard}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">To approve this request and grant signup access, log into the JobDock admin panel and navigate to Settings → Early Access.</p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: 'New Early Access Request',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
New Early Access Request

Someone has requested early access to JobDock:

Name: ${name}
Email: ${email}

To approve this request and grant signup access, log into the JobDock admin panel and navigate to Settings → Early Access.
  `.trim()

  return {
    to: '',
    subject,
    htmlBody,
    textBody,
    replyTo: email,
  }
}

/**
 * Email template: Early access approval notification (to user)
 */
export function buildEarlyAccessApprovalEmail(data: {
  name: string
  email: string
  signupUrl: string
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { name, signupUrl, companyName, logoUrl, settings } = data

  const subject = `Welcome to JobDock - Your Access is Approved!`

  const displayCompanyName = companyName || 'JobDock'
  
  const actionButton = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #D4AF37; border-radius: 6px;">
                <a href="${signupUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Create Your Account</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Great news! Your early access request has been approved.</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">You can now create your account and start using JobDock to manage your jobs, quotes, and schedules.</p>
    ${actionButton}
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">Or copy and paste this link into your browser:</p>
    <p style="margin: 10px 0 0 0; background-color: #f8f9fa; padding: 12px; border-radius: 6px; word-break: break-all; color: #0B132B; font-size: 14px; line-height: 1.5;">${signupUrl}</p>
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">If you have any questions, just reply to this email.</p>
    <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">Looking forward to having you on board!</p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: 'Welcome to JobDock!',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Welcome to JobDock!

Hi ${name},

Great news! Your early access request has been approved.

You can now create your account and start using JobDock to manage your jobs, quotes, and schedules.

Create your account here:
${signupUrl}

If you have any questions, just reply to this email.

Looking forward to having you on board!

Best,
The JobDock Team
  `.trim()

  return {
    to: data.email,
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Build team invite email payload
 */
export function buildTeamInviteEmail(data: {
  inviteeEmail: string
  inviteeName: string
  inviterName: string
  role: string
  tempPassword: string
  appUrl?: string
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}) {
  const { inviteeEmail, inviteeName, inviterName, role, tempPassword, appUrl, companyName, logoUrl, settings } = data
  const loginUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/auth/login` : 'https://app.thejobdock.com/auth/login'

  const subject = `You've been invited to join JobDock`
  const roleDesc =
    role === 'admin'
      ? 'admin (full access to jobs, contacts, quotes, invoices)'
      : 'employee (track hours, add photos and notes on jobs)'

  const displayCompanyName = companyName || 'JobDock'
  
  const passwordCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5; font-weight: 600;">Your Temporary Password</p>
                <p style="margin: 8px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4; font-family: monospace;">${tempPassword}</p>
                <p style="margin: 12px 0 0 0; color: #856404; font-size: 13px; line-height: 1.5;">Please change this when you first log in.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const actionButton = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #D4AF37; border-radius: 6px;">
                <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Log in to JobDock</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
  
  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${inviteeName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">${inviterName} has invited you to join their team on JobDock as a <strong>${role}</strong>.</p>
    <p style="margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">You'll have ${roleDesc}.</p>
    ${passwordCard}
    ${actionButton}
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">Or copy this link: <a href="${loginUrl}" style="color: #D4AF37; text-decoration: none;">${loginUrl}</a></p>
  `
  
  const htmlBody = buildModernEmailTemplate({
    title: "You've been invited to JobDock",
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  return {
    to: inviteeEmail,
    subject,
    htmlBody,
    textBody: `Hi ${inviteeName}, ${inviterName} has invited you to JobDock as ${role} (${roleDesc}). Temporary password: ${tempPassword}. Log in at ${loginUrl} and change your password.`,
  }
}

/**
 * Build and send invoice email with PDF attachment
 */
export async function sendInvoiceEmail(data: {
  invoiceData: any
  tenantName?: string
  tenantId: string
}): Promise<void> {
  const { invoiceData, tenantName, tenantId } = data

  const clientEmail = invoiceData.contactEmail
  if (!clientEmail) {
    throw new Error('Contact does not have an email address')
  }

  const clientName = invoiceData.contactName || 'Valued Customer'

  // Get custom email template from settings
  const prisma = (await import('./db')).default
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  })

  // Use custom template or default
  let subject = settings?.invoiceEmailSubject || `Invoice {{invoice_number}} from {{company_name}}`
  let bodyTemplate =
    settings?.invoiceEmailBody ||
    `Hi {{customer_name}},\n\nPlease find attached invoice {{invoice_number}}.\n\nThank you for your business!`

  // Replace template variables
  const companyName = settings?.companyDisplayName || tenantName || 'JobDock'
  subject = subject
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{invoice_number\}\}/g, invoiceData.invoiceNumber)
    .replace(/\{\{customer_name\}\}/g, clientName)

  bodyTemplate = bodyTemplate
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{invoice_number\}\}/g, invoiceData.invoiceNumber)
    .replace(/\{\{customer_name\}\}/g, clientName)

  const dueDateText = invoiceData.dueDate
    ? new Date(invoiceData.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Upon Receipt'

  // Check tracking flags (default to true for backward compatibility)
  const trackResponse = invoiceData.trackResponse !== false

  // Convert body template newlines to HTML
  const bodyHtml = bodyTemplate
    .split('\n')
    .map(line => `<p>${line}</p>`)
    .join('')

  // Generate approval token and URLs (only if tracking response)
  const approvalToken = trackResponse ? generateApprovalToken('invoice', invoiceData.id, tenantId) : null
  const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
  const acceptUrl = trackResponse ? `${publicAppUrl}/public/invoice/${invoiceData.id}/accept?token=${approvalToken}` : ''
  const declineUrl = trackResponse ? `${publicAppUrl}/public/invoice/${invoiceData.id}/decline?token=${approvalToken}` : ''

  // Fetch logo URL if available (7 days expiration for email)
  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
    } catch (error) {
      console.error('Error fetching logo URL for email:', error)
    }
  }

  // Build modern HTML email template
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Invoice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #0B132B 0%, #1A1F36 100%); border-radius: 8px 8px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    ${logoUrl ? `
                      <img src="${logoUrl}" alt="${companyName}" style="max-height: 70px; max-width: 280px; display: block; margin: 0 auto;" />
                    ` : `
                      <h1 style="margin: 0; color: #D4AF37; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; text-align: center;">${companyName}</h1>
                    `}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #0B132B; font-size: 24px; font-weight: 600; line-height: 1.3;">New Invoice</h2>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
              
              ${bodyHtml}
              
              <!-- Invoice Details Card -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Invoice Number</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${invoiceData.invoiceNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Total Amount</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 24px; font-weight: 700; line-height: 1.4; color: #D4AF37;">$${invoiceData.total.toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Due Date</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dueDateText}</p>
                        </td>
                      </tr>
                      ${invoiceData.paymentTerms ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Payment Terms</p>
                          <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${invoiceData.paymentTerms}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              ${trackResponse ? `
              <!-- Action Buttons -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0 0 20px 0;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; font-weight: 500; line-height: 1.5;">Please confirm receipt and acceptance of this invoice:</p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding: 0 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #D4AF37; border-radius: 6px;">
                                <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Approve Invoice</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" style="padding: 0 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #6c757d; border-radius: 6px;">
                                <a href="${declineUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Decline Invoice</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">Thank you for your business!</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              ${settings?.companySupportEmail || settings?.companyPhone ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${settings?.companySupportEmail ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Questions? Contact us at <a href="mailto:${settings.companySupportEmail}" style="color: #D4AF37; text-decoration: none;">${settings.companySupportEmail}</a>
                    </p>
                  </td>
                </tr>
                ` : ''}
                ${settings?.companyPhone ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Call us at <a href="tel:${settings.companyPhone}" style="color: #D4AF37; text-decoration: none;">${settings.companyPhone}</a>
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
              ` : ''}
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  const textBody = `
New Invoice

Hi ${clientName},

Please find your invoice attached as a PDF document.

Invoice Number: ${invoiceData.invoiceNumber}
Total Amount: $${invoiceData.total.toFixed(2)}
Due Date: ${dueDateText}
${invoiceData.paymentTerms ? `Payment Terms: ${invoiceData.paymentTerms}` : ''}

${trackResponse ? `**PLEASE CONFIRM RECEIPT:**

Approve Invoice: ${acceptUrl}

Decline Invoice: ${declineUrl}

` : ''}Please remit payment by the due date.

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business!
  `.trim()

  // Generate PDF with company info
  const pdfBuffer = await generateInvoicePDF(invoiceData, tenantName, {
    name: companyName,
    email: settings?.companySupportEmail || undefined,
    phone: settings?.companyPhone || undefined,
    logoKey: settings?.logoUrl || undefined,
    templateKey: settings?.invoicePdfTemplateKey || undefined,
  })

  // Send email with PDF attachment
  await sendEmailWithAttachments({
    to: clientEmail,
    subject,
    htmlBody,
    textBody,
    fromName: companyName,
    replyTo: settings?.companySupportEmail || undefined,
    attachments: [
      {
        filename: `Invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}
