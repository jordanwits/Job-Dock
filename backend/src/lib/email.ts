import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

// Email configuration from environment variables
const SES_ENABLED = process.env.SES_ENABLED === 'true'
const SES_REGION = process.env.SES_REGION || 'us-east-1'
const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS || 'noreply@jobdock.dev'

// Initialize SES client if enabled
let sesClient: SESClient | null = null
if (SES_ENABLED) {
  sesClient = new SESClient({ region: SES_REGION })
}

export interface EmailPayload {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
}

/**
 * Send an email using AWS SES or log to console in dev mode
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, htmlBody, textBody } = payload

  if (SES_ENABLED && sesClient) {
    // Send via AWS SES
    try {
      const command = new SendEmailCommand({
        Source: SES_FROM_ADDRESS,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            ...(textBody && {
              Text: {
                Data: textBody,
                Charset: 'UTF-8',
              },
            }),
          },
        },
      })

      await sesClient.send(command)
      console.log(`✅ Email sent via SES to ${to}: ${subject}`)
    } catch (error) {
      console.error('❌ Failed to send email via SES:', error)
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } else {
    // Log to console in dev mode
    console.log('\n📧 =============== EMAIL (Dev Mode) ===============')
    console.log(`To: ${to}`)
    console.log(`From: ${SES_FROM_ADDRESS}`)
    console.log(`Subject: ${subject}`)
    console.log('---')
    console.log(textBody || htmlBody.replace(/<[^>]*>/g, ''))
    console.log('================================================\n')
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
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location, tenantName } = data
  
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

  const subject = `Your booking is confirmed - ${serviceName}`
  
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">Booking Confirmed</h2>
        <p>Hi ${clientName},</p>
        <p>Your booking has been confirmed! Here are the details:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr} - ${endTimeStr}</p>
          ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
          ${tenantName ? `<p style="margin: 5px 0;"><strong>Provider:</strong> ${tenantName}</p>` : ''}
        </div>
        <p>We look forward to seeing you!</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you need to cancel or reschedule, please contact us as soon as possible.
        </p>
      </body>
    </html>
  `

  const textBody = `
Booking Confirmed

Hi ${clientName},

Your booking has been confirmed! Here are the details:

Service: ${serviceName}
Date: ${dateStr}
Time: ${startTimeStr} - ${endTimeStr}
${location ? `Location: ${location}` : ''}
${tenantName ? `Provider: ${tenantName}` : ''}

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
  const { contractorName, serviceName, clientName, clientEmail, clientPhone, startTime, endTime, location, isPending } = data
  
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
 * Email template: Client booking confirmed (after pending)
 */
export function buildClientBookingConfirmedEmail(data: {
  clientName: string
  serviceName: string
  startTime: Date
  endTime: Date
  location?: string
}): EmailPayload {
  const { clientName, serviceName, startTime, endTime, location } = data
  
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

  const bookingId = `#${Date.now().toString().slice(-6)}`
  const subject = `Your booking has been confirmed ${bookingId} - ${serviceName}`
  
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50;">✓ Booking Confirmed</h2>
        <p>Hi ${clientName},</p>
        <p>Great news! Your booking request has been confirmed.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${startTimeStr} - ${endTimeStr}</p>
          ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
        </div>
        <p>We look forward to seeing you!</p>
      </body>
    </html>
  `

  const textBody = `
✓ Booking Confirmed

Hi ${clientName},

Great news! Your booking request has been confirmed.

Service: ${serviceName}
Date: ${dateStr}
Time: ${startTimeStr} - ${endTimeStr}
${location ? `Location: ${location}` : ''}

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

