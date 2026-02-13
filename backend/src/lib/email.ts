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
    console.log('\n📧 =============== EMAIL (Dev Mode - Resend Not Configured) ===============')
    console.log(`EMAIL_PROVIDER: ${EMAIL_PROVIDER}`)
    console.log(`RESEND_API_KEY: ${RESEND_API_KEY ? 'SET' : 'NOT SET'}`)
    console.log(`resendClient: ${resendClient ? 'INITIALIZED' : 'NULL'}`)
    console.log(`To: ${to}`)
    console.log(`From: ${fromName ? `${fromName} <${EMAIL_FROM_ADDRESS}>` : EMAIL_FROM_ADDRESS}`)
    if (replyTo) console.log(`Reply-To: ${replyTo}`)
    console.log(`Subject: ${subject}`)
    console.log('---')
    console.log(textBody || htmlBody.replace(/<[^>]*>/g, ''))
    console.log('================================================\n')
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
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, tenantName, breaks } = data

  // Detect if this is a multi-day job
  const durationMs = endTime.getTime() - startTime.getTime()
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDateStr = endTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const subject = `Your booking is confirmed - ${serviceName}`

  // Build breaks section if present
  let breaksHtml = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStart = new Date(b.startTime)
        const bEnd = new Date(b.endTime)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `<li style="margin: 5px 0;">${bStart.toLocaleDateString()} – ${bEnd.toLocaleDateString()}${reason}</li>`
        } else {
          return `<li style="margin: 5px 0;">${bStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${bEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${reason}</li>`
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

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">Booking Confirmed</h2>
        <p>Hi ${clientName},</p>
        <p>Your booking has been confirmed! Here are the details:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          ${
            isMultiDay
              ? `<p style="margin: 5px 0;"><strong>Duration:</strong> ${dateStr} through ${endDateStr}</p>`
              : `<p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
               <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr} - ${endTimeStr}</p>`
          }
          ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
          ${tenantName ? `<p style="margin: 5px 0;"><strong>Provider:</strong> ${tenantName}</p>` : ''}
        </div>
        ${breaksHtml}
        <p>We look forward to seeing you!</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you need to cancel or reschedule, please contact us as soon as possible.
        </p>
      </body>
    </html>
  `

  // Build breaks section for text version
  let breaksText = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStart = new Date(b.startTime)
        const bEnd = new Date(b.endTime)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `  - ${bStart.toLocaleDateString()} – ${bEnd.toLocaleDateString()}${reason}`
        } else {
          return `  - ${bStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${bEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${reason}`
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
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime } = data

  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const bookingId = `#${Date.now().toString().slice(-6)}`
  const subject = `Booking request received ${bookingId} - ${serviceName}`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">Booking Request Received</h2>
        <p>Hi ${clientName},</p>
        <p>We've received your booking request for:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr}</p>
        </div>
        <p>Your request is pending confirmation. We'll send you another email once it's confirmed.</p>
        <p>Thank you for your patience!</p>
      </body>
    </html>
  `

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
  } = data

  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const subject = isPending
    ? `New booking request for ${serviceName}`
    : `New booking for ${serviceName}`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">${isPending ? 'New Booking Request' : 'New Booking'}</h2>
        <p>Hi ${contractorName},</p>
        <p>You have a new booking${isPending ? ' request' : ''} for <strong>${serviceName}</strong>.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
          ${clientEmail ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${clientEmail}</p>` : ''}
          ${clientPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${clientPhone}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr} - ${endTimeStr}</p>
          ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
        </div>
        ${isPending ? '<p style="color: #ff6b6b; font-weight: bold;">⚠️ This booking requires your confirmation. Please log in to your dashboard to confirm or decline.</p>' : '<p>This booking has been automatically confirmed.</p>'}
        <p><a href="${process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'}/scheduling" style="background: #D4AF37; color: #0B132B; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View in Dashboard</a></p>
      </body>
    </html>
  `

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
}): EmailPayload {
  const { assigneeName, assigneeEmail, assignerName, jobTitle, startTime, endTime, location, contactName, viewPath = '/app/scheduling', fromName, replyTo } = data

  const dateStr = startTime
    ? startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'To be scheduled'
  const timeStr =
    startTime && endTime
      ? `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : ''

  const subject = `You've been assigned: ${jobTitle}`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">Job Assignment</h2>
        <p>Hi ${assigneeName},</p>
        <p><strong>${assignerName}</strong> has assigned you to a job.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Job:</strong> ${jobTitle}</p>
          ${contactName ? `<p style="margin: 5px 0;"><strong>Contact:</strong> ${contactName}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          ${timeStr ? `<p style="margin: 5px 0;"><strong>Time:</strong> ${timeStr}</p>` : ''}
          ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
        </div>
        <p><a href="${(process.env.PUBLIC_APP_URL || 'https://app.thejobdock.com').replace(/\/$/, '')}${viewPath}" style="background: #D4AF37; color: #0B132B; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View in Dashboard</a></p>
      </body>
    </html>
  `

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
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, breaks } = data

  // Detect if this is a multi-day job
  const durationMs = endTime.getTime() - startTime.getTime()
  const isMultiDay = durationMs >= 24 * 60 * 60 * 1000

  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDateStr = endTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const bookingId = `#${Date.now().toString().slice(-6)}`
  const subject = `Your booking has been confirmed ${bookingId} - ${serviceName}`

  // Build breaks section if present
  let breaksHtml = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStart = new Date(b.startTime)
        const bEnd = new Date(b.endTime)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `<li style="margin: 5px 0;">${bStart.toLocaleDateString()} – ${bEnd.toLocaleDateString()}${reason}</li>`
        } else {
          return `<li style="margin: 5px 0;">${bStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${bEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${reason}</li>`
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

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50;">✓ Booking Confirmed</h2>
        <p>Hi ${clientName},</p>
        <p>Great news! Your booking request has been confirmed.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          ${
            isMultiDay
              ? `<p style="margin: 5px 0;"><strong>Duration:</strong> ${dateStr} through ${endDateStr}</p>`
              : `<p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
               <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr} - ${endTimeStr}</p>`
          }
          ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
        </div>
        ${breaksHtml}
        <p>We look forward to seeing you!</p>
      </body>
    </html>
  `

  // Build breaks section for text version
  let breaksText = ''
  if (breaks && breaks.length > 0) {
    const breaksList = breaks
      .map(b => {
        const bStart = new Date(b.startTime)
        const bEnd = new Date(b.endTime)
        const reason = b.reason ? ` (${b.reason})` : ''
        if (isMultiDay) {
          return `  - ${bStart.toLocaleDateString()} – ${bEnd.toLocaleDateString()}${reason}`
        } else {
          return `  - ${bStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${bEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${reason}`
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
}): EmailPayload {
  const { clientName, serviceName, startTime, reason } = data

  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const subject = `Booking request declined - ${serviceName}`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #ff6b6b;">Booking Request Declined</h2>
        <p>Hi ${clientName},</p>
        <p>Unfortunately, we're unable to accommodate your booking request for:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr}</p>
        </div>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>We apologize for any inconvenience. Please feel free to try booking a different time slot.</p>
      </body>
    </html>
  `

  const textBody = `
Booking Request Declined

Hi ${clientName},

Unfortunately, we're unable to accommodate your booking request for:

Service: ${serviceName}
Date: ${dateStr}
Time: ${startTimeStr}

${reason ? `Reason: ${reason}` : ''}

We apologize for any inconvenience. Please feel free to try booking a different time slot.
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
                  <td align="left" style="vertical-align: middle;">
                    ${logoUrl ? `
                      <img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px; display: block;" />
                    ` : `
                      <h1 style="margin: 0; color: #D4AF37; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">${companyName}</h1>
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
export function buildEarlyAccessRequestEmail(data: { name: string; email: string }): EmailPayload {
  const { name, email } = data

  const subject = `New Early Access Request from ${name}`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">New Early Access Request</h2>
        <p>Someone has requested early access to JobDock:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
        </div>
        <p>To approve this request and grant signup access, log into the JobDock admin panel and navigate to Settings → Early Access.</p>
      </body>
    </html>
  `

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
}): EmailPayload {
  const { name, signupUrl } = data

  const subject = `Welcome to JobDock - Your Access is Approved!`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">Welcome to JobDock!</h2>
        <p>Hi ${name},</p>
        <p>Great news! Your early access request has been approved.</p>
        <p>You can now create your account and start using JobDock to manage your jobs, quotes, and schedules.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${signupUrl}" style="display: inline-block; padding: 15px 30px; background: #D4AF37; color: #1A1F36; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Create Your Account
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
          ${signupUrl}
        </p>
        <p>If you have any questions, just reply to this email.</p>
        <p>Looking forward to having you on board!</p>
        <p style="margin-top: 30px; color: #666;">
          Best,<br/>
          The JobDock Team
        </p>
      </body>
    </html>
  `

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
}) {
  const { inviteeEmail, inviteeName, inviterName, role, tempPassword, appUrl } = data
  const loginUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/auth/login` : 'https://app.thejobdock.com/auth/login'

  const subject = `You've been invited to join JobDock`
  const roleDesc =
    role === 'admin'
      ? 'admin (full access to jobs, contacts, quotes, invoices)'
      : 'employee (track hours, add photos and notes on jobs)'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #D4AF37;">You've been invited to JobDock</h2>
      <p>Hi ${inviteeName},</p>
      <p>${inviterName} has invited you to join their team on JobDock as a <strong>${role}</strong>.</p>
      <p style="font-size: 0.9em; color: #666;">You'll have ${roleDesc}.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Your temporary password:</strong></p>
        <p style="margin: 5px 0; font-family: monospace; font-size: 14px;">${tempPassword}</p>
        <p style="margin: 10px 0 0 0; font-size: 0.9em;">Please change this when you first log in.</p>
      </div>
      <p><a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #D4AF37; color: #1A1F36; text-decoration: none; border-radius: 5px; font-weight: bold;">Log in to JobDock</a></p>
      <p style="font-size: 0.85em; color: #666;">Or copy this link: ${loginUrl}</p>
      <p style="margin-top: 30px; color: #666;">Best,<br/>The JobDock Team</p>
    </body>
    </html>
  `

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
                  <td align="left" style="vertical-align: middle;">
                    ${logoUrl ? `
                      <img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px; display: block;" />
                    ` : `
                      <h1 style="margin: 0; color: #D4AF37; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">${companyName}</h1>
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
