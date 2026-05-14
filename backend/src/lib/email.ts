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

function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

      // Log full response for debugging
      console.log('📧 Resend API response:', JSON.stringify(result, null, 2))

      // Check Resend response structure - it can be { data: { id: ... } } or { id: ... } or error
      const emailId = (result as any)?.data?.id ?? (result as any)?.id ?? (result as any)?.data ?? 'unknown'
      const hasError = (result as any)?.error

      if (hasError) {
        const errorMsg = typeof hasError === 'string' ? hasError : JSON.stringify(hasError)
        console.error('❌ Resend API returned error:', errorMsg)
        console.error('Full Resend response:', JSON.stringify(result, null, 2))
        throw new Error(`Resend API error: ${errorMsg}`)
      }

      if (!emailId || emailId === 'unknown') {
        console.warn('⚠️ Resend API response missing email ID. Full response:', JSON.stringify(result, null, 2))
      }

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
 * Send a password reset email containing a one-time magic link.
 */
export async function sendPasswordResetEmail(args: {
  to: string
  resetUrl: string
  expiresInMinutes: number
}): Promise<void> {
  const { to, resetUrl, expiresInMinutes } = args
  const safeUrl = escapeHtmlForEmail(resetUrl)
  const htmlBody = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h1 style="font-size:20px;margin:0 0 16px">Reset your JobDock password</h1>
      <p style="margin:0 0 16px;line-height:1.5">
        We received a request to reset your password. Click the button below to choose a new one.
        This link expires in ${expiresInMinutes} minutes.
      </p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">
          Reset password
        </a>
      </p>
      <p style="margin:16px 0;font-size:13px;color:#555;line-height:1.5">
        If the button doesn't work, paste this URL into your browser:<br/>
        <span style="word-break:break-all">${safeUrl}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#555">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `
  const textBody =
    `Reset your JobDock password\n\n` +
    `We received a request to reset your password. Use this link to choose a new one ` +
    `(expires in ${expiresInMinutes} minutes):\n\n${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email.`

  await sendEmail({
    to,
    subject: 'Reset your JobDock password',
    htmlBody,
    textBody,
    fromName: 'JobDock',
  })
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

      console.log(`📧 Attempting to send email with attachments via Resend to ${to}: ${subject}`)

      // Convert Buffer attachments to base64 strings for Resend
      const resendAttachments = attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
      }))

      const result = await resendClient.emails.send({
        from: fromAddress,
        to,
        subject,
        html: htmlBody,
        ...(textBody && { text: textBody }),
        ...(replyTo && { reply_to: replyTo }),
        ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
      })

      // Log full response for debugging
      console.log('📧 Resend API response (with attachments):', JSON.stringify(result, null, 2))

      // Check Resend response structure - it can be { data: { id: ... } } or { id: ... } or error
      const emailId = (result as any)?.data?.id ?? (result as any)?.id ?? (result as any)?.data ?? 'unknown'
      const hasError = (result as any)?.error

      if (hasError) {
        const errorMsg = typeof hasError === 'string' ? hasError : JSON.stringify(hasError)
        console.error('❌ Resend API returned error:', errorMsg)
        console.error('Full Resend response:', JSON.stringify(result, null, 2))
        throw new Error(`Resend API error: ${errorMsg}`)
      }

      if (!emailId || emailId === 'unknown') {
        console.warn('⚠️ Resend API response missing email ID. Full response:', JSON.stringify(result, null, 2))
      }

      console.log(
        `✅ Email with attachments sent via Resend to ${to}: ${subject}${replyTo ? ` (Reply-To: ${replyTo})` : ''} (ID: ${emailId})`
      )
    } catch (error) {
      console.error('❌ Failed to send email with attachments via Resend:', error)
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
  jobId?: string
  rescheduleToken?: string
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, tenantName, breaks, timezoneOffset = -8, companyName, logoUrl, settings, jobId, rescheduleToken } = data

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
  
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const rescheduleUrl = jobId && rescheduleToken ? `${publicAppUrl}/public/booking/${jobId}/reschedule?token=${rescheduleToken}` : null

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Your booking has been confirmed! Here are the details:</p>
    ${bookingDetailsCard}
    ${breaksHtml}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We look forward to seeing you!</p>
    ${rescheduleUrl ? `
    <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
      <a href="${rescheduleUrl}" style="display: inline-block; padding: 12px 24px; background-color: #D4AF37; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 6px;">Reschedule</a>
    </p>
    <p style="margin: 12px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">Need to change your appointment? Use the button above to pick a new time.</p>
    ` : '<p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">If you need to cancel or reschedule, please contact us as soon as possible.</p>'}
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
${rescheduleUrl ? '\n\nNeed to change your appointment? Reschedule here: ' + rescheduleUrl : '\n\nIf you need to cancel or reschedule, please contact us as soon as possible.'}
  `.trim()

  return {
    to: '', // Will be set by caller with actual email address
    subject,
    htmlBody,
    textBody,
  }
}

/**
 * Email template: Client reschedule notification
 */
export function buildClientRescheduleEmail(data: {
  clientName: string
  serviceName: string
  startTime: Date
  endTime: Date
  location?: string
  tenantName?: string
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
  timezoneOffset?: number
  companyName?: string
  logoUrl?: string | null
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, tenantName, breaks, timezoneOffset = -8, companyName, logoUrl, settings } = data

  const startLocal = getLocalTimeComponents(startTime, timezoneOffset)
  const endLocal = getLocalTimeComponents(endTime, timezoneOffset)
  const durationMs = endTime.getTime() - startTime.getTime()
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  const dateStr = formatDateLong(startLocal.year, startLocal.month, startLocal.day)
  const endDateStr = formatDateLong(endLocal.year, endLocal.month, endLocal.day)
  const startTimeStr = formatTime12Hour(startLocal.hours, startLocal.minutes)
  const endTimeStr = formatTime12Hour(endLocal.hours, endLocal.minutes)

  const subject = `Your appointment has been rescheduled - ${serviceName}`

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
        <ul style="margin: 10px 0; padding-left: 20px;">${breaksList}</ul>
      </div>
    `
  }

  const displayCompanyName = companyName || tenantName || 'JobDock'

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
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">New Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr} through ${endDateStr}</p>
              </td>
            </tr>
            ` : `
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">New Date</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${dateStr}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">New Time</p>
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
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Your appointment has been rescheduled. Here are the updated details:</p>
    ${bookingDetailsCard}
    ${breaksHtml}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We look forward to seeing you at the new time!</p>
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">If you need to cancel or reschedule, please contact us as soon as possible.</p>
  `

  const htmlBody = buildModernEmailTemplate({
    title: 'Appointment Rescheduled',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

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
    breaksText = `\nSchedule Notes:\nThis job includes planned pauses:\n${breaksList}\n`
  }

  const textBody = `
Appointment Rescheduled

Hi ${clientName},

Your appointment has been rescheduled. Here are the updated details:

Service: ${serviceName}
${isMultiDay ? `New Date: ${dateStr} through ${endDateStr}` : `New Date: ${dateStr}\nNew Time: ${startTimeStr} - ${endTimeStr}`}
${location ? `Location: ${location}` : ''}
${tenantName ? `Provider: ${tenantName}` : ''}
${breaksText}

We look forward to seeing you at the new time!

If you need to cancel or reschedule, please contact us as soon as possible.
  `.trim()

  return {
    to: '',
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
  jobId?: string
  rescheduleToken?: string
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, timezoneOffset = -8, companyName, logoUrl, settings, jobId, rescheduleToken } = data

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
  
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const rescheduleUrl = jobId && rescheduleToken ? `${publicAppUrl}/public/booking/${jobId}/reschedule?token=${rescheduleToken}` : null

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">We've received your booking request for:</p>
    ${bookingDetailsCard}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">Your request is pending confirmation. We'll send you another email once it's confirmed.</p>
    ${rescheduleUrl ? `
    <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
      <a href="${rescheduleUrl}" style="display: inline-block; padding: 12px 24px; background-color: #D4AF37; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 6px;">Reschedule</a>
    </p>
    <p style="margin: 12px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">Need a different time? Use the button above to request a new slot.</p>
    ` : ''}
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
${rescheduleUrl ? `

Need a different time? Reschedule here: ${rescheduleUrl}` : ''}

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
  jobId?: string
  rescheduleToken?: string
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, breaks, timezoneOffset = -8, companyName, logoUrl, settings, jobId, rescheduleToken } = data

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
  
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const rescheduleUrl = jobId && rescheduleToken ? `${publicAppUrl}/public/booking/${jobId}/reschedule?token=${rescheduleToken}` : null

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Great news! Your booking request has been confirmed.</p>
    ${bookingDetailsCard}
    ${breaksHtml}
    <p style="margin: 30px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">We look forward to seeing you!</p>
    ${rescheduleUrl ? `
    <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
      <a href="${rescheduleUrl}" style="display: inline-block; padding: 12px 24px; background-color: #D4AF37; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 6px;">Reschedule</a>
    </p>
    <p style="margin: 12px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">Need to change your appointment? Use the button above to pick a new time.</p>
    ` : ''}
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
${rescheduleUrl ? `

Need to change your appointment? Reschedule here: ${rescheduleUrl}` : ''}
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
 * Email template: Notify JobDock user when client accepts a quote
 */
export function buildQuoteAcceptedNotificationEmail(data: {
  userName: string
  userEmail: string
  quoteNumber: string
  clientName: string
  total: number
  companyName?: string
  logoUrl?: string | null
  fromName?: string
  replyTo?: string
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { userName, userEmail, quoteNumber, clientName, total, companyName, logoUrl, fromName, replyTo, settings } = data

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total)

  const subject = `Quote ${quoteNumber} accepted by ${clientName}`

  const displayCompanyName = companyName || fromName || 'JobDock'
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const viewUrl = `${publicAppUrl}/app/quotes`

  const detailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #e8f5e9; border-radius: 8px; border: 1px solid #4caf50;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${clientName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Quote</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${quoteNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Total</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${formattedTotal}</p>
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
                <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View Quotes</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Great news! <strong>${clientName}</strong> has accepted quote <strong>${quoteNumber}</strong>.</p>
    ${detailsCard}
    ${actionButton}
  `

  const htmlBody = buildModernEmailTemplate({
    title: 'Quote Accepted',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Quote Accepted

Hi ${userName},

Great news! ${clientName} has accepted quote ${quoteNumber} (${formattedTotal}).

View quotes: ${viewUrl}
  `.trim()

  return {
    to: userEmail,
    subject,
    htmlBody,
    textBody,
    fromName,
    replyTo,
  }
}

/**
 * Email template: Notify JobDock user when client accepts an invoice
 */
export function buildInvoiceAcceptedNotificationEmail(data: {
  userName: string
  userEmail: string
  invoiceNumber: string
  clientName: string
  total: number
  companyName?: string
  logoUrl?: string | null
  fromName?: string
  replyTo?: string
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const { userName, userEmail, invoiceNumber, clientName, total, companyName, logoUrl, fromName, replyTo, settings } = data

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total)

  const subject = `Invoice ${invoiceNumber} accepted by ${clientName}`

  const displayCompanyName = companyName || fromName || 'JobDock'
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const viewUrl = `${publicAppUrl}/app/invoices`

  const detailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #e8f5e9; border-radius: 8px; border: 1px solid #4caf50;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${clientName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Invoice</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${invoiceNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Total</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${formattedTotal}</p>
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
                <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View Invoices</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Great news! <strong>${clientName}</strong> has accepted invoice <strong>${invoiceNumber}</strong>.</p>
    ${detailsCard}
    ${actionButton}
  `

  const htmlBody = buildModernEmailTemplate({
    title: 'Invoice Accepted',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Invoice Accepted

Hi ${userName},

Great news! ${clientName} has accepted invoice ${invoiceNumber} (${formattedTotal}).

View invoices: ${viewUrl}
  `.trim()

  return {
    to: userEmail,
    subject,
    htmlBody,
    textBody,
    fromName,
    replyTo,
  }
}

/**
 * Email template: Notify JobDock admin/owner when client declines a quote
 */
export function buildQuoteDeclinedNotificationEmail(data: {
  userName: string
  userEmail: string
  quoteNumber: string
  clientName: string
  total: number
  declineReason?: string | null
  companyName?: string
  logoUrl?: string | null
  fromName?: string
  replyTo?: string
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const {
    userName,
    userEmail,
    quoteNumber,
    clientName,
    total,
    declineReason,
    companyName,
    logoUrl,
    fromName,
    replyTo,
    settings,
  } = data

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total)

  const subject = `Quote ${quoteNumber} declined by ${clientName}`

  const displayCompanyName = companyName || fromName || 'JobDock'
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const viewUrl = `${publicAppUrl}/app/quotes`

  const detailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #fdecea; border-radius: 8px; border: 1px solid #f44336;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${clientName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Quote</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${quoteNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Total</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${formattedTotal}</p>
              </td>
            </tr>
            ${
              declineReason
                ? `<tr>
              <td style="padding: 12px 0 0 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client note (optional)</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${escapeHtmlForEmail(declineReason)}</p>
              </td>
            </tr>`
                : ''
            }
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
                <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View Quotes</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;"><strong>${clientName}</strong> has declined quote <strong>${quoteNumber}</strong>.</p>
    ${detailsCard}
    ${actionButton}
  `

  const htmlBody = buildModernEmailTemplate({
    title: 'Quote Declined',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Quote Declined

Hi ${userName},

${clientName} has declined quote ${quoteNumber} (${formattedTotal}).${declineReason ? `\n\nClient note:\n${declineReason}` : ''}

View quotes: ${viewUrl}
  `.trim()

  return {
    to: userEmail,
    subject,
    htmlBody,
    textBody,
    fromName,
    replyTo,
  }
}

/**
 * Email template: Notify JobDock admin/owner when client declines an invoice
 */
export function buildInvoiceDeclinedNotificationEmail(data: {
  userName: string
  userEmail: string
  invoiceNumber: string
  clientName: string
  total: number
  declineReason?: string | null
  companyName?: string
  logoUrl?: string | null
  fromName?: string
  replyTo?: string
  settings?: {
    companySupportEmail?: string | null
    companyPhone?: string | null
  }
}): EmailPayload {
  const {
    userName,
    userEmail,
    invoiceNumber,
    clientName,
    total,
    declineReason,
    companyName,
    logoUrl,
    fromName,
    replyTo,
    settings,
  } = data

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total)

  const subject = `Invoice ${invoiceNumber} declined by ${clientName}`

  const displayCompanyName = companyName || fromName || 'JobDock'
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev').replace(/\/$/, '')
  const viewUrl = `${publicAppUrl}/app/invoices`

  const detailsCard = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #fdecea; border-radius: 8px; border: 1px solid #f44336;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 18px; font-weight: 600; line-height: 1.4;">${clientName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Invoice</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${invoiceNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Total</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 16px; font-weight: 500; line-height: 1.4;">${formattedTotal}</p>
              </td>
            </tr>
            ${
              declineReason
                ? `<tr>
              <td style="padding: 12px 0 0 0;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">Client note (optional)</p>
                <p style="margin: 4px 0 0 0; color: #0B132B; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${escapeHtmlForEmail(declineReason)}</p>
              </td>
            </tr>`
                : ''
            }
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
                <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View Invoices</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;"><strong>${clientName}</strong> has declined invoice <strong>${invoiceNumber}</strong>.</p>
    ${detailsCard}
    ${actionButton}
  `

  const htmlBody = buildModernEmailTemplate({
    title: 'Invoice Declined',
    content,
    companyName: displayCompanyName,
    logoUrl,
    settings,
  })

  const textBody = `
Invoice Declined

Hi ${userName},

${clientName} has declined invoice ${invoiceNumber} (${formattedTotal}).${declineReason ? `\n\nClient note:\n${declineReason}` : ''}

View invoices: ${viewUrl}
  `.trim()

  return {
    to: userEmail,
    subject,
    htmlBody,
    textBody,
    fromName,
    replyTo,
  }
}

/**
 * Send quote accepted notification to all tenant users via email
 */
export async function sendQuoteAcceptedNotificationToUsers(data: {
  tenantId: string
  quoteNumber: string
  clientName: string
  total: number
}): Promise<void> {
  const prisma = (await import('./db')).default

  const users = await prisma.user.findMany({
    where: { tenantId: data.tenantId },
    select: { id: true, name: true, email: true },
  })

  const usersWithEmail = users.filter(u => u.email && u.email.trim())
  if (usersWithEmail.length === 0) return

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: data.tenantId },
  })
  const fromName = settings?.companyDisplayName || 'JobDock'
  const replyTo = settings?.companySupportEmail || undefined

  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
    } catch (error) {
      console.error('Error fetching logo URL for acceptance email:', error)
    }
  }

  for (const user of usersWithEmail) {
    const payload = buildQuoteAcceptedNotificationEmail({
      userName: user.name || 'there',
      userEmail: user.email!,
      quoteNumber: data.quoteNumber,
      clientName: data.clientName,
      total: data.total,
      companyName: fromName,
      logoUrl,
      fromName,
      replyTo,
      settings: {
        companySupportEmail: settings?.companySupportEmail || null,
        companyPhone: settings?.companyPhone || null,
      },
    })
    await sendEmail(payload)
  }
}

/**
 * Send invoice accepted notification to all tenant users via email
 */
export async function sendInvoiceAcceptedNotificationToUsers(data: {
  tenantId: string
  invoiceNumber: string
  clientName: string
  total: number
}): Promise<void> {
  const prisma = (await import('./db')).default

  const users = await prisma.user.findMany({
    where: { tenantId: data.tenantId },
    select: { id: true, name: true, email: true },
  })

  const usersWithEmail = users.filter(u => u.email && u.email.trim())
  if (usersWithEmail.length === 0) return

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: data.tenantId },
  })
  const fromName = settings?.companyDisplayName || 'JobDock'
  const replyTo = settings?.companySupportEmail || undefined

  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
    } catch (error) {
      console.error('Error fetching logo URL for acceptance email:', error)
    }
  }

  for (const user of usersWithEmail) {
    const payload = buildInvoiceAcceptedNotificationEmail({
      userName: user.name || 'there',
      userEmail: user.email!,
      invoiceNumber: data.invoiceNumber,
      clientName: data.clientName,
      total: data.total,
      companyName: fromName,
      logoUrl,
      fromName,
      replyTo,
      settings: {
        companySupportEmail: settings?.companySupportEmail || null,
        companyPhone: settings?.companyPhone || null,
      },
    })
    await sendEmail(payload)
  }
}

/**
 * Send quote declined notification to tenant admins/owner via email
 */
export async function sendQuoteDeclinedNotificationToAdmins(data: {
  tenantId: string
  quoteNumber: string
  clientName: string
  total: number
  declineReason?: string | null
}): Promise<void> {
  const prisma = (await import('./db')).default

  const admins = await prisma.user.findMany({
    where: {
      tenantId: data.tenantId,
      role: { in: ['admin', 'owner'] },
    },
    select: { id: true, name: true, email: true },
  })

  const adminsWithEmail = admins.filter(u => u.email && u.email.trim())
  if (adminsWithEmail.length === 0) return

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: data.tenantId },
  })
  const fromName = settings?.companyDisplayName || 'JobDock'
  const replyTo = settings?.companySupportEmail || undefined

  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
    } catch (error) {
      console.error('Error fetching logo URL for decline email:', error)
    }
  }

  for (const admin of adminsWithEmail) {
    const payload = buildQuoteDeclinedNotificationEmail({
      userName: admin.name || 'there',
      userEmail: admin.email!,
      quoteNumber: data.quoteNumber,
      clientName: data.clientName,
      total: data.total,
      declineReason: data.declineReason,
      companyName: fromName,
      logoUrl,
      fromName,
      replyTo,
      settings: {
        companySupportEmail: settings?.companySupportEmail || null,
        companyPhone: settings?.companyPhone || null,
      },
    })
    await sendEmail(payload)
  }
}

/**
 * Send invoice declined notification to tenant admins/owner via email
 */
export async function sendInvoiceDeclinedNotificationToAdmins(data: {
  tenantId: string
  invoiceNumber: string
  clientName: string
  total: number
  declineReason?: string | null
}): Promise<void> {
  const prisma = (await import('./db')).default

  const admins = await prisma.user.findMany({
    where: {
      tenantId: data.tenantId,
      role: { in: ['admin', 'owner'] },
    },
    select: { id: true, name: true, email: true },
  })

  const adminsWithEmail = admins.filter(u => u.email && u.email.trim())
  if (adminsWithEmail.length === 0) return

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: data.tenantId },
  })
  const fromName = settings?.companyDisplayName || 'JobDock'
  const replyTo = settings?.companySupportEmail || undefined

  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60)
    } catch (error) {
      console.error('Error fetching logo URL for decline email:', error)
    }
  }

  for (const admin of adminsWithEmail) {
    const payload = buildInvoiceDeclinedNotificationEmail({
      userName: admin.name || 'there',
      userEmail: admin.email!,
      invoiceNumber: data.invoiceNumber,
      clientName: data.clientName,
      total: data.total,
      declineReason: data.declineReason,
      companyName: fromName,
      logoUrl,
      fromName,
      replyTo,
      settings: {
        companySupportEmail: settings?.companySupportEmail || null,
        companyPhone: settings?.companyPhone || null,
      },
    })
    await sendEmail(payload)
  }
}

/**
 * Build and send quote email with PDF attachment
 */
export async function sendQuoteEmail(data: {
  quoteData: any
  tenantName?: string
  tenantId: string
  approvalToken?: string
}): Promise<void> {
  const { quoteData, tenantName, tenantId, approvalToken: providedToken } = data

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
    `Hi {{customer_name}}, please find your quote attached.`

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

  const displayTitle = (quoteData.title && quoteData.title.trim()) ? quoteData.title.trim() : quoteData.quoteNumber

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

  // Use provided token or generate (allows reuse for SMS)
  const approvalToken = providedToken ?? generateApprovalToken('quote', quoteData.id, tenantId)
  const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
  const viewUrl = `${publicAppUrl}/public/quote/${quoteData.id}?token=${approvalToken}`
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
  <title>${displayTitle}</title>
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
              <h2 style="margin: 0 0 20px 0; color: #0B132B; font-size: 24px; font-weight: 600; line-height: 1.3;">${displayTitle}</h2>
              
              ${bodyHtml}
              
              <!-- Action Buttons -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0 0 20px 0;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; font-weight: 500; line-height: 1.5;">View your quote and respond:</p>
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
                                <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View Quote & Respond</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" style="padding: 0 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #6c757d; border-radius: 6px;">
                                <a href="${declineUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Quick Decline</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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
${displayTitle}

Hi ${clientName},

Please find your quote attached as a PDF document.

**PLEASE RESPOND TO THIS QUOTE:**

View quote and respond: ${viewUrl}

Quick decline: ${declineUrl}
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
 * Build signup completion email payload (sent after Stripe checkout for new signups).
 * Used when user closes the create-account page before completing it - they get this
 * email with a link to finish signup.
 */
export function buildSignupCompleteEmail(data: {
  to: string
  signupUrl: string
}) {
  const { to, signupUrl } = data

  const subject = 'Complete your JobDock account setup'

  const actionButton = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #D4AF37; border-radius: 6px;">
                <a href="${signupUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Complete signup</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const content = `
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">Thanks for subscribing to JobDock!</p>
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">You've completed payment. Click below to finish setting up your account:</p>
    ${actionButton}
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">Or copy this link: <a href="${signupUrl}" style="color: #D4AF37; text-decoration: none;">${signupUrl}</a></p>
  `

  const htmlBody = buildModernEmailTemplate({
    title: 'Complete your JobDock account',
    content,
  })

  return {
    to,
    subject,
    htmlBody,
    textBody: `Thanks for subscribing to JobDock! You've completed payment. Finish setting up your account: ${signupUrl}`,
  }
}

/**
 * Build and send invoice email with PDF attachment
 */
export async function sendInvoiceEmail(data: {
  invoiceData: any
  tenantName?: string
  tenantId: string
  approvalToken?: string | null
}): Promise<void> {
  const { invoiceData, tenantName, tenantId, approvalToken: providedToken } = data

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
    `Hi {{customer_name}}, please find your invoice attached.`

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

  const displayTitle = (invoiceData.title && invoiceData.title.trim()) ? invoiceData.title.trim() : invoiceData.invoiceNumber

  // Convert body template newlines to HTML
  const bodyHtml = bodyTemplate
    .split('\n')
    .map(line => `<p>${line}</p>`)
    .join('')

  // Use provided token or generate (allows reuse for SMS)
  const approvalToken = trackResponse
    ? (providedToken ?? generateApprovalToken('invoice', invoiceData.id, tenantId))
    : null
  const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
  const viewUrl = trackResponse ? `${publicAppUrl}/public/invoice/${invoiceData.id}?token=${approvalToken}` : ''
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
  <title>${displayTitle}</title>
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
              <h2 style="margin: 0 0 20px 0; color: #0B132B; font-size: 24px; font-weight: 600; line-height: 1.3;">${displayTitle}</h2>
              
              ${bodyHtml}
              
              ${trackResponse ? `
              <!-- Action Buttons -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0 0 20px 0;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; font-weight: 500; line-height: 1.5;">View your invoice and respond:</p>
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
                                <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; color: #0B132B; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">View Invoice & Respond</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" style="padding: 0 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #6c757d; border-radius: 6px;">
                                <a href="${declineUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; line-height: 1.5; border-radius: 6px;">Quick Decline</a>
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
${displayTitle}

Hi ${clientName},

Please find your invoice attached as a PDF document.

${trackResponse ? `**PLEASE CONFIRM RECEIPT:**

View invoice and respond: ${viewUrl}

Quick decline: ${declineUrl}
` : ''}
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
