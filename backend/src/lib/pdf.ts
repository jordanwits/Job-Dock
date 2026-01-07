import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface QuoteData {
  id: string
  quoteNumber: string
  contactName?: string
  contactEmail?: string
  contactCompany?: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  notes?: string
  validUntil?: string
  createdAt: string
}

interface InvoiceData {
  id: string
  invoiceNumber: string
  contactName?: string
  contactEmail?: string
  contactCompany?: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  status: string
  paymentStatus: string
  notes?: string
  dueDate?: string
  paymentTerms?: string
  paidAmount: number
  createdAt: string
}

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Colors
const goldColor = rgb(212 / 255, 175 / 255, 55 / 255)
const darkGray = rgb(51 / 255, 51 / 255, 51 / 255)
const mediumGray = rgb(102 / 255, 102 / 255, 102 / 255)
const lightGray = rgb(204 / 255, 204 / 255, 204 / 255)
const greenColor = rgb(76 / 255, 175 / 255, 80 / 255)
const redColor = rgb(255 / 255, 107 / 255, 107 / 255)
const orangeColor = rgb(255 / 255, 165 / 255, 0 / 255)

/**
 * Generate a PDF buffer for a quote
 */
export async function generateQuotePDF(quote: QuoteData, tenantName?: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const { width, height } = page.getSize()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = height - 50

  // Header - Company name
  page.drawText(tenantName || 'JobDock', {
    x: 50,
    y,
    size: 24,
    font: fontBold,
    color: goldColor,
  })

  y -= 20
  page.drawText('Professional Services Quote', {
    x: 50,
    y,
    size: 10,
    font: fontRegular,
    color: mediumGray,
  })

  // Quote details (right side)
  let rightY = height - 50
  page.drawText('QUOTE', {
    x: width - 100,
    y: rightY,
    size: 20,
    font: fontBold,
    color: darkGray,
  })

  rightY -= 25
  page.drawText(`Quote #: ${quote.quoteNumber}`, {
    x: width - 150,
    y: rightY,
    size: 10,
    font: fontRegular,
    color: mediumGray,
  })

  rightY -= 15
  page.drawText(`Date: ${formatDate(quote.createdAt)}`, {
    x: width - 150,
    y: rightY,
    size: 10,
    font: fontRegular,
    color: mediumGray,
  })

  if (quote.validUntil) {
    rightY -= 15
    page.drawText(`Valid Until: ${formatDate(quote.validUntil)}`, {
      x: width - 150,
      y: rightY,
      size: 10,
      font: fontRegular,
      color: mediumGray,
    })
  }

  // Client information
  y = height - 140
  page.drawText('Bill To:', {
    x: 50,
    y,
    size: 12,
    font: fontBold,
    color: darkGray,
  })

  y -= 20
  if (quote.contactName) {
    page.drawText(quote.contactName, { x: 50, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 15
  }
  if (quote.contactCompany) {
    page.drawText(quote.contactCompany, { x: 50, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 15
  }
  if (quote.contactEmail) {
    page.drawText(quote.contactEmail, { x: 50, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 15
  }

  // Line items table header
  y -= 40
  const tableTop = y
  page.drawText('Description', { x: 50, y, size: 10, font: fontBold, color: darkGray })
  page.drawText('Qty', { x: 320, y, size: 10, font: fontBold, color: darkGray })
  page.drawText('Unit Price', { x: 380, y, size: 10, font: fontBold, color: darkGray })
  page.drawText('Total', { x: 480, y, size: 10, font: fontBold, color: darkGray })

  // Line below headers
  y -= 8
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: lightGray,
  })

  // Line items
  y -= 20
  for (const item of quote.lineItems) {
    if (y < 100) {
      break // Simple handling - don't add more items if running out of space
    }

    // Truncate description if too long
    let desc = item.description
    if (desc.length > 40) {
      desc = desc.substring(0, 37) + '...'
    }

    page.drawText(desc, { x: 50, y, size: 9, font: fontRegular, color: mediumGray })
    page.drawText(item.quantity.toString(), { x: 320, y, size: 9, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(item.unitPrice), { x: 380, y, size: 9, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(item.total), { x: 480, y, size: 9, font: fontRegular, color: mediumGray })

    y -= 20
  }

  // Totals section
  y -= 20
  const totalsX = 380

  page.drawText('Subtotal:', { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
  page.drawText(formatCurrency(quote.subtotal), { x: 480, y, size: 10, font: fontRegular, color: mediumGray })

  y -= 20
  if (quote.taxRate > 0) {
    page.drawText(`Tax (${(quote.taxRate * 100).toFixed(1)}%):`, { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(quote.taxAmount), { x: 480, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 20
  }

  if (quote.discount > 0) {
    page.drawText('Discount:', { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
    page.drawText(`-${formatCurrency(quote.discount)}`, { x: 480, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 20
  }

  // Line above total
  page.drawLine({
    start: { x: totalsX, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 1,
    color: lightGray,
  })

  y -= 10
  page.drawText('Total:', { x: totalsX, y, size: 12, font: fontBold, color: darkGray })
  page.drawText(formatCurrency(quote.total), { x: 480, y, size: 14, font: fontBold, color: goldColor })

  // Notes
  if (quote.notes) {
    y -= 40
    if (y > 80) {
      page.drawText('Notes:', { x: 50, y, size: 10, font: fontBold, color: darkGray })
      y -= 15
      
      // Truncate notes if too long
      let notes = quote.notes
      if (notes.length > 200) {
        notes = notes.substring(0, 197) + '...'
      }
      page.drawText(notes, { x: 50, y, size: 9, font: fontRegular, color: mediumGray })
    }
  }

  // Footer
  page.drawText('Thank you for your business!', {
    x: 50,
    y: 30,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Generate a PDF buffer for an invoice
 */
export async function generateInvoicePDF(invoice: InvoiceData, tenantName?: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const { width, height } = page.getSize()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = height - 50

  // Header - Company name
  page.drawText(tenantName || 'JobDock', {
    x: 50,
    y,
    size: 24,
    font: fontBold,
    color: goldColor,
  })

  y -= 20
  page.drawText('Professional Services Invoice', {
    x: 50,
    y,
    size: 10,
    font: fontRegular,
    color: mediumGray,
  })

  // Invoice details (right side)
  let rightY = height - 50
  page.drawText('INVOICE', {
    x: width - 120,
    y: rightY,
    size: 20,
    font: fontBold,
    color: darkGray,
  })

  rightY -= 25
  page.drawText(`Invoice #: ${invoice.invoiceNumber}`, {
    x: width - 170,
    y: rightY,
    size: 10,
    font: fontRegular,
    color: mediumGray,
  })

  rightY -= 15
  page.drawText(`Date: ${formatDate(invoice.createdAt)}`, {
    x: width - 170,
    y: rightY,
    size: 10,
    font: fontRegular,
    color: mediumGray,
  })

  if (invoice.dueDate) {
    rightY -= 15
    const dueDateColor = invoice.paymentStatus === 'paid' ? greenColor : redColor
    page.drawText(`Due Date: ${formatDate(invoice.dueDate)}`, {
      x: width - 170,
      y: rightY,
      size: 10,
      font: fontRegular,
      color: dueDateColor,
    })
  }

  if (invoice.paymentTerms) {
    rightY -= 15
    page.drawText(`Terms: ${invoice.paymentTerms}`, {
      x: width - 170,
      y: rightY,
      size: 10,
      font: fontRegular,
      color: mediumGray,
    })
  }

  // Payment status badge
  rightY -= 20
  const statusText = invoice.paymentStatus === 'paid' 
    ? 'PAID' 
    : invoice.paymentStatus === 'partial' 
    ? 'PARTIAL' 
    : 'UNPAID'
  const statusColor = invoice.paymentStatus === 'paid' 
    ? greenColor 
    : invoice.paymentStatus === 'partial' 
    ? orangeColor 
    : redColor

  page.drawText(statusText, {
    x: width - 100,
    y: rightY,
    size: 12,
    font: fontBold,
    color: statusColor,
  })

  // Client information
  y = height - 140
  page.drawText('Bill To:', {
    x: 50,
    y,
    size: 12,
    font: fontBold,
    color: darkGray,
  })

  y -= 20
  if (invoice.contactName) {
    page.drawText(invoice.contactName, { x: 50, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 15
  }
  if (invoice.contactCompany) {
    page.drawText(invoice.contactCompany, { x: 50, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 15
  }
  if (invoice.contactEmail) {
    page.drawText(invoice.contactEmail, { x: 50, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 15
  }

  // Line items table header
  y -= 40
  page.drawText('Description', { x: 50, y, size: 10, font: fontBold, color: darkGray })
  page.drawText('Qty', { x: 320, y, size: 10, font: fontBold, color: darkGray })
  page.drawText('Unit Price', { x: 380, y, size: 10, font: fontBold, color: darkGray })
  page.drawText('Total', { x: 480, y, size: 10, font: fontBold, color: darkGray })

  // Line below headers
  y -= 8
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: lightGray,
  })

  // Line items
  y -= 20
  for (const item of invoice.lineItems) {
    if (y < 150) {
      break
    }

    let desc = item.description
    if (desc.length > 40) {
      desc = desc.substring(0, 37) + '...'
    }

    page.drawText(desc, { x: 50, y, size: 9, font: fontRegular, color: mediumGray })
    page.drawText(item.quantity.toString(), { x: 320, y, size: 9, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(item.unitPrice), { x: 380, y, size: 9, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(item.total), { x: 480, y, size: 9, font: fontRegular, color: mediumGray })

    y -= 20
  }

  // Totals section
  y -= 20
  const totalsX = 380

  page.drawText('Subtotal:', { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
  page.drawText(formatCurrency(invoice.subtotal), { x: 480, y, size: 10, font: fontRegular, color: mediumGray })

  y -= 20
  if (invoice.taxRate > 0) {
    page.drawText(`Tax (${(invoice.taxRate * 100).toFixed(1)}%):`, { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(invoice.taxAmount), { x: 480, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 20
  }

  if (invoice.discount > 0) {
    page.drawText('Discount:', { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
    page.drawText(`-${formatCurrency(invoice.discount)}`, { x: 480, y, size: 10, font: fontRegular, color: mediumGray })
    y -= 20
  }

  // Line above total
  page.drawLine({
    start: { x: totalsX, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 1,
    color: lightGray,
  })

  y -= 10
  page.drawText('Total:', { x: totalsX, y, size: 12, font: fontBold, color: darkGray })
  page.drawText(formatCurrency(invoice.total), { x: 480, y, size: 14, font: fontBold, color: goldColor })

  // Payment information
  if (invoice.paidAmount > 0) {
    y -= 25
    page.drawText('Paid:', { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
    page.drawText(formatCurrency(invoice.paidAmount), { x: 480, y, size: 10, font: fontRegular, color: greenColor })

    const balance = invoice.total - invoice.paidAmount
    if (balance > 0) {
      y -= 20
      page.drawText('Balance Due:', { x: totalsX, y, size: 10, font: fontRegular, color: mediumGray })
      page.drawText(formatCurrency(balance), { x: 480, y, size: 10, font: fontRegular, color: redColor })
    }
  }

  // Notes
  if (invoice.notes) {
    y -= 40
    if (y > 80) {
      page.drawText('Notes:', { x: 50, y, size: 10, font: fontBold, color: darkGray })
      y -= 15
      
      let notes = invoice.notes
      if (notes.length > 200) {
        notes = notes.substring(0, 197) + '...'
      }
      page.drawText(notes, { x: 50, y, size: 9, font: fontRegular, color: mediumGray })
    }
  }

  // Footer
  page.drawText('Thank you for your business! Please remit payment by the due date.', {
    x: 50,
    y: 30,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
