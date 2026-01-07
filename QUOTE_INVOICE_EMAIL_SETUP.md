# Quote & Invoice Email Setup Guide

## Overview

JobDock now supports sending quotes and invoices to clients via email with PDF attachments. This feature uses the existing AWS SES infrastructure and generates professional PDF documents automatically.

## Features Implemented

### Backend

1. **PDF Generation** (`backend/src/lib/pdf.ts`)
   - Quote PDF generator with line items, totals, and validity dates
   - Invoice PDF generator with payment status, due dates, and balance tracking
   - Professional formatting with branding (tenant name support)

2. **Email Sending** (`backend/src/lib/email.ts`)
   - `sendQuoteEmail()` - Sends quote with PDF attachment
   - `sendInvoiceEmail()` - Sends invoice with PDF attachment
   - HTML and text email templates
   - MIME multipart email with attachment support

3. **API Endpoints** (`backend/src/lib/dataService.ts`)
   - `POST /quotes/{id}/send` - Send quote to client
   - `POST /invoices/{id}/send` - Send invoice to client
   - Automatic status update to 'sent' after successful send
   - Validates contact has email address before sending

### Frontend

1. **API Integration** (`src/lib/api/services.ts`)
   - `quotesService.send(id)` - Frontend API method
   - `invoicesService.send(id)` - Frontend API method

2. **State Management** (Zustand stores)
   - `useQuoteStore.sendQuote(id)` - Sends quote and updates state
   - `useInvoiceStore.sendInvoice(id)` - Sends invoice and updates state

3. **UI Components**
   - **QuoteDetail.tsx**: "Send Quote" button in detail modal
   - **InvoiceDetail.tsx**: "Send Invoice" button in detail modal
   - Success/error notifications inline
   - Automatic status update in UI after send
   - Button label changes to "Resend" after first send
   - Button disabled if contact has no email

## Configuration

### Environment Variables

The following environment variables are already configured in the Lambda functions:

```typescript
SES_ENABLED: 'true'                              // Email sending enabled
SES_REGION: 'us-east-1'                          // AWS region for SES
SES_FROM_ADDRESS: 'jordan@westwavecreative.com'  // Sender email address
```

These are set in `infrastructure/lib/jobdock-stack.ts` (lines 390-392).

### AWS SES Requirements

Before emails will send in production:

1. **Verify the sender email address** in AWS SES:
   ```bash
   aws ses verify-email-identity \
     --email-address jordan@westwavecreative.com \
     --region us-east-1
   ```
   Then click the verification link in the email.

2. **Move out of SES Sandbox** (production only):
   - In AWS Console → SES → Account dashboard
   - Click "Request production access"
   - Provide use case: "Sending quotes and invoices to clients"
   - Usually approved within 24 hours

3. **Grant SES permissions to Lambda** (already configured):
   The Lambda execution role includes SES send permissions via the IAM policy.

## Testing Guide

### 1. Development Testing (Console Logs)

In development, emails are logged to CloudWatch instead of being sent:

1. Create a test quote with a contact that has an email
2. Open the quote detail modal
3. Click "Send Quote"
4. Check the Lambda logs in CloudWatch for:
   ```
   📧 =============== EMAIL WITH ATTACHMENTS (Dev Mode) ===============
   To: client@example.com
   From: jordan@westwavecreative.com
   Subject: Quote QT-001 from JobDock
   Attachments: Quote-QT-001.pdf
   ```

### 2. Production Testing (Real Emails)

Once SES is verified and out of sandbox mode:

1. **Test Quote Email:**
   ```bash
   # Create a quote via the UI
   # Add line items and set contact email
   # Click "Send Quote"
   # Check recipient inbox for email with PDF attachment
   ```

2. **Test Invoice Email:**
   ```bash
   # Create an invoice via the UI
   # Add line items and set contact email
   # Click "Send Invoice"
   # Check recipient inbox for email with PDF attachment
   ```

3. **Verify Email Contents:**
   - Subject line includes quote/invoice number
   - Email body includes summary (number, total, due/valid date)
   - PDF attachment is present and opens correctly
   - PDF contains all line items, totals, taxes, discounts
   - Contact information is correct
   - Tenant branding appears if configured

### 3. End-to-End Test Checklist

- [ ] Contact has email address
- [ ] Quote/invoice has line items
- [ ] Click "Send Quote/Invoice" button
- [ ] Loading state shows "Sending..."
- [ ] Success message appears: "✓ Quote sent successfully to {email}"
- [ ] Status updates to "sent" in the UI
- [ ] Button label changes to "Resend Quote/Invoice"
- [ ] Email arrives in recipient inbox
- [ ] PDF attachment is present and correct
- [ ] Email content matches quote/invoice data

### 4. Error Scenarios to Test

- [ ] Contact has no email address → Button disabled with tooltip
- [ ] Network error during send → Error message displays
- [ ] Invalid quote/invoice ID → 404 error handled
- [ ] SES rate limit exceeded → Error message displays

## Email Templates

### Quote Email

**Subject:** `Quote {quoteNumber} from {tenantName}`

**Body:**
- Greeting with client name
- Quote summary (number, total, validity date)
- Request to review attached PDF
- Call to action to contact with questions

**Attachment:** `Quote-{quoteNumber}.pdf`

### Invoice Email

**Subject:** `Invoice {invoiceNumber} from {tenantName}`

**Body:**
- Greeting with client name
- Invoice summary (number, total, due date, payment status)
- Balance due if applicable
- Payment reminder
- Contact information

**Attachment:** `Invoice-{invoiceNumber}.pdf`

## Troubleshooting

### Email Not Sending

1. **Check SES verification:**
   ```bash
   aws ses get-identity-verification-attributes \
     --identities jordan@westwavecreative.com \
     --region us-east-1
   ```

2. **Check CloudWatch logs:**
   ```bash
   aws logs tail /aws/lambda/JobDockStack-dev-DataLambda --follow
   ```

3. **Verify environment variables:**
   - SES_ENABLED should be 'true'
   - SES_FROM_ADDRESS must be verified in SES
   - SES_REGION must match where email is verified

### PDF Generation Issues

1. **Check PDF library installation:**
   ```bash
   cd backend
   npm list pdfkit
   ```

2. **Verify build output includes pdfkit:**
   ```bash
   cd backend
   npm run build
   ```

3. **Check Lambda layer if using:**
   Ensure pdfkit and @types/pdfkit are in dependencies, not devDependencies

### Contact Has No Email

- The "Send" button will be disabled
- Tooltip shows: "Contact does not have an email address"
- User must edit the contact to add an email before sending

## Architecture

```mermaid
flowchart TB
    UI[Quote/Invoice Detail Modal] --> Button[Send Button Click]
    Button --> Store[Zustand Store sendQuote/sendInvoice]
    Store --> API[API Client POST /quotes/{id}/send]
    API --> Lambda[Data Lambda Handler]
    Lambda --> DataService[dataServices.quotes/invoices.send]
    DataService --> LoadData[Load Quote/Invoice + Contact]
    LoadData --> Validate{Has Email?}
    Validate -->|No| Error[Throw Error]
    Validate -->|Yes| PDF[Generate PDF]
    PDF --> Email[Build Email with Attachment]
    Email --> SES[Send via AWS SES]
    SES --> UpdateStatus[Update Status to 'sent']
    UpdateStatus --> Response[Return Updated Data]
    Response --> Store
    Store --> UI
```

## Deployment

### Rebuild Backend

After code changes, rebuild the backend:

```bash
cd backend
npm run build
```

### Deploy to AWS

```bash
cd infrastructure
npm run deploy:dev   # For development
npm run deploy:prod  # For production
```

### Verify Deployment

1. Check Lambda function updated:
   ```bash
   aws lambda get-function --function-name JobDockStack-dev-DataLambda
   ```

2. Test API endpoint:
   ```bash
   curl -X POST https://your-api.execute-api.us-east-1.amazonaws.com/dev/quotes/{id}/send \
     -H "Authorization: Bearer {token}"
   ```

## Future Enhancements

Potential improvements for future iterations:

1. **Custom Templates:** Allow tenants to customize email templates
2. **Branding:** Support tenant logos in PDF headers
3. **Multiple Recipients:** CC/BCC support for sending to multiple contacts
4. **Scheduling:** Schedule quote/invoice sends for specific date/time
5. **Tracking:** Track email opens and PDF downloads
6. **Reminders:** Automatic reminders for overdue invoices
7. **Language Support:** Multi-language templates for international clients
8. **Payment Links:** Embedded payment links in invoice emails

## Support

For issues or questions:
- Check CloudWatch logs for detailed error messages
- Verify SES configuration in AWS Console
- Review this guide for common troubleshooting steps
- Contact support with specific error messages and timestamps

