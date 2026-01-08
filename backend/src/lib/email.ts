import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { generateQuotePDF, generateInvoicePDF } from './pdf'

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

export interface EmailWithAttachment {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
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
 * Create MIME message with attachments for raw email sending
 */
function createMimeMessage(payload: EmailWithAttachment): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
  const { to, subject, htmlBody, textBody, attachments = [] } = payload

  let mime = [
    `From: ${SES_FROM_ADDRESS}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: multipart/alternative; boundary="alt-boundary"',
    '',
    '--alt-boundary',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textBody || htmlBody.replace(/<[^>]*>/g, ''),
    '',
    '--alt-boundary',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '',
    '--alt-boundary--',
  ].join('\r\n')

  // Add attachments
  attachments.forEach((attachment) => {
    const base64Content = attachment.content.toString('base64')
    mime += [
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      base64Content,
    ].join('\r\n')
  })

  mime += `\r\n--${boundary}--`

  return mime
}

/**
 * Send an email with attachments using AWS SES raw email API
 */
export async function sendEmailWithAttachments(payload: EmailWithAttachment): Promise<void> {
  const { to, subject, htmlBody, textBody, attachments = [] } = payload

  if (SES_ENABLED && sesClient) {
    try {
      const mimeMessage = createMimeMessage(payload)
      const command = new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(mimeMessage),
        },
      })

      await sesClient.send(command)
      console.log(`✅ Email with attachments sent via SES to ${to}: ${subject}`)
    } catch (error) {
      console.error('❌ Failed to send email with attachments via SES:', error)
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } else {
    // Log to console in dev mode
    console.log('\n📧 =============== EMAIL WITH ATTACHMENTS (Dev Mode) ===============')
    console.log(`To: ${to}`)
    console.log(`From: ${SES_FROM_ADDRESS}`)
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
  let bodyTemplate = settings?.quoteEmailBody || `Hi {{customer_name}},\n\nPlease find attached quote {{quote_number}}.\n\nWe look forward to working with you!`
  
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
  const bodyHtml = bodyTemplate.split('\n').map(line => `<p>${line}</p>`).join('')
  
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">New Quote</h2>
        ${bodyHtml}
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${quoteData.quoteNumber}</p>
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> $${quoteData.total.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${validUntilText}</p>
        </div>
        ${settings?.companySupportEmail ? `<p style="color: #666; font-size: 0.9em;">Questions? Contact us at ${settings.companySupportEmail}</p>` : ''}
        ${settings?.companyPhone ? `<p style="color: #666; font-size: 0.9em;">Call us at ${settings.companyPhone}</p>` : ''}
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
          This is an automated message. Please do not reply to this email.
        </p>
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
  })

  // Send email with PDF attachment
  await sendEmailWithAttachments({
    to: clientEmail,
    subject,
    htmlBody,
    textBody,
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
  let bodyTemplate = settings?.invoiceEmailBody || `Hi {{customer_name}},\n\nPlease find attached invoice {{invoice_number}}.\n\nThank you for your business!`
  
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

  const paymentStatusText =
    invoiceData.paymentStatus === 'paid'
      ? 'Paid in Full'
      : invoiceData.paymentStatus === 'partial'
      ? 'Partially Paid'
      : 'Payment Pending'

  const statusColor =
    invoiceData.paymentStatus === 'paid'
      ? '#4CAF50'
      : invoiceData.paymentStatus === 'partial'
      ? '#FFA500'
      : '#ff6b6b'

  const balance = invoiceData.total - invoiceData.paidAmount

  // Convert body template newlines to HTML
  const bodyHtml = bodyTemplate.split('\n').map(line => `<p>${line}</p>`).join('')
  
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #D4AF37;">New Invoice</h2>
        ${bodyHtml}
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> $${invoiceData.total.toFixed(2)}</p>
          ${invoiceData.paidAmount > 0 ? `<p style="margin: 5px 0;"><strong>Paid:</strong> $${invoiceData.paidAmount.toFixed(2)}</p>` : ''}
          ${balance > 0 ? `<p style="margin: 5px 0;"><strong>Balance Due:</strong> <span style="color: ${statusColor};">$${balance.toFixed(2)}</span></p>` : ''}
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDateText}</p>
          <p style="margin: 5px 0;"><strong>Payment Status:</strong> <span style="color: ${statusColor};">${paymentStatusText}</span></p>
          ${invoiceData.paymentTerms ? `<p style="margin: 5px 0;"><strong>Payment Terms:</strong> ${invoiceData.paymentTerms}</p>` : ''}
        </div>
        ${settings?.companySupportEmail ? `<p style="color: #666; font-size: 0.9em;">Questions? Contact us at ${settings.companySupportEmail}</p>` : ''}
        ${settings?.companyPhone ? `<p style="color: #666; font-size: 0.9em;">Call us at ${settings.companyPhone}</p>` : ''}
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </body>
    </html>
  `

  const textBody = `
New Invoice

Hi ${clientName},

Please find your invoice attached as a PDF document.

Invoice Number: ${invoiceData.invoiceNumber}
Total Amount: $${invoiceData.total.toFixed(2)}
${invoiceData.paidAmount > 0 ? `Paid: $${invoiceData.paidAmount.toFixed(2)}` : ''}
${balance > 0 ? `Balance Due: $${balance.toFixed(2)}` : ''}
Due Date: ${dueDateText}
Payment Status: ${paymentStatusText}
${invoiceData.paymentTerms ? `Payment Terms: ${invoiceData.paymentTerms}` : ''}

${balance > 0 ? 'Please remit payment by the due date.' : 'Thank you for your payment!'}

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business!
  `.trim()

  // Generate PDF with company info
  const pdfBuffer = await generateInvoicePDF(invoiceData, tenantName, {
    name: companyName,
    email: settings?.companySupportEmail || undefined,
    phone: settings?.companyPhone || undefined,
    logoKey: settings?.logoUrl || undefined,
  })

  // Send email with PDF attachment
  await sendEmailWithAttachments({
    to: clientEmail,
    subject,
    htmlBody,
    textBody,
    attachments: [
      {
        filename: `Invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

