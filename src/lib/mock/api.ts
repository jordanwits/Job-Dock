/**
 * Mock API Service Layer
 *
 * This file provides mock implementations of all API services.
 * Replace these with real API calls when backend is ready.
 *
 * The structure matches the real API structure, making the transition seamless.
 */

// Mock delay to simulate network requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Load mock storage from localStorage or initialize empty
const loadMockStorage = () => {
  try {
    const stored = localStorage.getItem('jobdock:mockStorage')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn('Failed to load mock storage from localStorage:', error)
  }
  return {
    contacts: [],
    quotes: [],
    invoices: [],
    schedules: [],
    jobs: [],
    services: [],
  }
}

// Save mock storage to localStorage
const saveMockStorage = () => {
  try {
    localStorage.setItem('jobdock:mockStorage', JSON.stringify(mockStorage))
  } catch (error) {
    console.warn('Failed to save mock storage to localStorage:', error)
  }
}

// Mock data storage (persisted to localStorage)
const mockStorage = loadMockStorage()

// Initialize with seed services if storage is empty
if (mockStorage.services.length === 0) {
  mockStorage.services = [
    // Seed services for booking testing
    {
      id: 'seed-service-001',
      name: 'Consultation',
      description: 'Initial consultation and site assessment',
      duration: 60,
      price: 100,
      isActive: true,
      availability: {
        workingHours: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isWorking: false },
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 6, startTime: '10:00', endTime: '14:00', isWorking: false },
        ],
        bufferTime: 15,
        advanceBookingDays: 30,
        sameDayBooking: false,
      },
      bookingSettings: {
        requireConfirmation: false,
        allowCancellation: true,
        cancellationHours: 24,
        maxBookingsPerSlot: 1,
        requireContactInfo: true,
        bookingFormFields: ['name', 'email', 'phone'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'seed-service-002',
      name: 'House Cleaning',
      description: 'Professional house cleaning service',
      duration: 120,
      price: 150,
      isActive: true,
      availability: {
        workingHours: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isWorking: false },
          { dayOfWeek: 1, startTime: '08:00', endTime: '18:00', isWorking: true },
          { dayOfWeek: 2, startTime: '08:00', endTime: '18:00', isWorking: true },
          { dayOfWeek: 3, startTime: '08:00', endTime: '18:00', isWorking: true },
          { dayOfWeek: 4, startTime: '08:00', endTime: '18:00', isWorking: true },
          { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', isWorking: true },
          { dayOfWeek: 6, startTime: '09:00', endTime: '14:00', isWorking: false },
        ],
        bufferTime: 30,
        advanceBookingDays: 60,
        sameDayBooking: false,
      },
      bookingSettings: {
        requireConfirmation: true, // This one requires confirmation!
        allowCancellation: true,
        cancellationHours: 48,
        maxBookingsPerSlot: 1,
        requireContactInfo: true,
        bookingFormFields: ['name', 'email', 'phone', 'notes'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  saveMockStorage()
}

// Mock Auth Service
export const mockAuthService = {
  login: async (email: string, password: string) => {
    await delay(500)
    // Trim whitespace and normalize email to lowercase for comparison
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()

    if (normalizedEmail === 'jordan@westwavecreative.com' && normalizedPassword === 'demo123') {
      return {
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'jordan@westwavecreative.com',
          name: 'Jordan',
          tenantId: 'tenant-1',
        },
      }
    }
    // Keep old demo account for backwards compatibility
    if (normalizedEmail === 'demo@jobdock.com' && normalizedPassword === 'demo123') {
      return {
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'demo@jobdock.com',
          name: 'Demo User',
          tenantId: 'tenant-1',
        },
      }
    }
    throw new Error('Invalid credentials')
  },

  register: async (data: {
    email: string
    password: string
    name: string
    companyName: string
  }) => {
    await delay(800)
    return {
      token: 'mock-jwt-token',
      user: {
        id: '2',
        email: data.email,
        name: data.name,
        tenantId: 'tenant-2',
      },
    }
  },

  logout: async () => {
    await delay(200)
    return { success: true }
  },

  resetPassword: async (email: string) => {
    await delay(500)
    return { success: true, message: 'Password reset email sent' }
  },
}

// Mock Contacts Service
export const mockContactsService = {
  getAll: async () => {
    await delay(300)
    return mockStorage.contacts
  },

  getById: async (id: string) => {
    await delay(200)
    const contact = mockStorage.contacts.find(c => c.id === id)
    if (!contact) throw new Error('Contact not found')
    return contact
  },

  create: async (data: any) => {
    await delay(400)
    const newContact = {
      id: String(mockStorage.contacts.length + 1),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      company: data.company || '',
      jobTitle: data.jobTitle || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zipCode: data.zipCode || '',
      country: data.country || '',
      tags: data.tags || [],
      notes: data.notes || '',
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockStorage.contacts.push(newContact)
    saveMockStorage()
    return newContact
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.contacts.findIndex(c => c.id === id)
    if (index === -1) throw new Error('Contact not found')
    const updatedContact = {
      ...mockStorage.contacts[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    mockStorage.contacts[index] = updatedContact
    saveMockStorage()
    return updatedContact
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.contacts.findIndex(c => c.id === id)
    if (index === -1) throw new Error('Contact not found')
    mockStorage.contacts.splice(index, 1)
    saveMockStorage()
    return { success: true }
  },
}

// Mock Quotes Service
export const mockQuotesService = {
  getAll: async () => {
    await delay(300)
    return mockStorage.quotes
  },

  getById: async (id: string) => {
    await delay(200)
    const quote = mockStorage.quotes.find(q => q.id === id)
    if (!quote) throw new Error('Quote not found')
    return quote
  },

  create: async (data: any) => {
    await delay(400)
    // Calculate totals
    const lineItems = data.lineItems.map((item: any, index: number) => ({
      id: String(index + 1),
      ...item,
      total: item.quantity * item.unitPrice,
    }))
    const subtotal = lineItems.reduce((sum: number, item: any) => sum + item.total, 0)
    const taxRate = data.taxRate || 0
    const taxAmount = subtotal * taxRate
    const discount = data.discount || 0
    const total = subtotal + taxAmount - discount

    const quoteNumber = `QT-${new Date().getFullYear()}-${String(mockStorage.quotes.length + 1).padStart(3, '0')}`

    const newQuote = {
      id: String(mockStorage.quotes.length + 1),
      quoteNumber,
      contactId: data.contactId,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      status: data.status || 'draft',
      notes: data.notes || '',
      validUntil: data.validUntil || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockStorage.quotes.push(newQuote)
    return newQuote
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.quotes.findIndex(q => q.id === id)
    if (index === -1) throw new Error('Quote not found')

    // Recalculate if line items changed
    let updatedQuote = { ...mockStorage.quotes[index], ...data }
    if (data.lineItems) {
      const lineItems = data.lineItems.map((item: any, idx: number) => ({
        id: item.id || String(idx + 1),
        ...item,
        total: item.quantity * item.unitPrice,
      }))
      const subtotal = lineItems.reduce((sum: number, item: any) => sum + item.total, 0)
      const taxRate = data.taxRate ?? updatedQuote.taxRate
      const taxAmount = subtotal * taxRate
      const discount = data.discount ?? updatedQuote.discount
      updatedQuote = {
        ...updatedQuote,
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        total: subtotal + taxAmount - discount,
      }
    } else if (data.taxRate !== undefined || data.discount !== undefined) {
      const subtotal = updatedQuote.subtotal
      const taxRate = data.taxRate ?? updatedQuote.taxRate
      const taxAmount = subtotal * taxRate
      const discount = data.discount ?? updatedQuote.discount
      updatedQuote = {
        ...updatedQuote,
        taxRate,
        taxAmount,
        discount,
        total: subtotal + taxAmount - discount,
      }
    }

    updatedQuote.updatedAt = new Date().toISOString()
    mockStorage.quotes[index] = updatedQuote
    return updatedQuote
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.quotes.findIndex(q => q.id === id)
    if (index === -1) throw new Error('Quote not found')
    mockStorage.quotes.splice(index, 1)
    return { success: true }
  },

  send: async (id: string) => {
    await delay(500)
    const index = mockStorage.quotes.findIndex(q => q.id === id)
    if (index === -1) throw new Error('Quote not found')

    const quote = mockStorage.quotes[index]
    const contact = mockStorage.contacts.find(c => c.id === quote.contactId)

    if (!contact?.email) {
      throw new Error('Contact does not have an email address')
    }

    // Update status to sent
    quote.status = 'sent'
    quote.updatedAt = new Date().toISOString()
    mockStorage.quotes[index] = quote
    saveMockStorage()

    // Log mock email
    console.log('\n📧 =============== QUOTE EMAIL (Mock Mode) ===============')
    console.log(`To: ${contact.email}`)
    console.log(`From: noreply@jobdock.dev`)
    console.log(`Subject: Quote ${quote.quoteNumber}`)
    console.log('---')
    console.log(`Hi ${contact.firstName},\n`)
    console.log(`Please find your quote attached.\n`)
    console.log(`Quote Number: ${quote.quoteNumber}`)
    console.log(`Total: $${quote.total.toFixed(2)}`)
    console.log(`Valid Until: ${quote.validUntil || 'N/A'}`)
    console.log('\n[PDF Attachment: Quote.pdf]')
    console.log('================================================\n')

    return {
      ...quote,
      contactName: `${contact.firstName} ${contact.lastName}`,
      contactEmail: contact.email,
      contactCompany: contact.company,
    }
  },
}

// Mock Invoices Service
export const mockInvoicesService = {
  getAll: async () => {
    await delay(300)
    return mockStorage.invoices
  },

  getById: async (id: string) => {
    await delay(200)
    const invoice = mockStorage.invoices.find(i => i.id === id)
    if (!invoice) throw new Error('Invoice not found')
    return invoice
  },

  create: async (data: any) => {
    await delay(400)
    // Calculate totals
    const lineItems = data.lineItems.map((item: any, index: number) => ({
      id: String(index + 1),
      ...item,
      total: item.quantity * item.unitPrice,
    }))
    const subtotal = lineItems.reduce((sum: number, item: any) => sum + item.total, 0)
    const taxRate = data.taxRate || 0
    const taxAmount = subtotal * taxRate
    const discount = data.discount || 0
    const total = subtotal + taxAmount - discount
    const paidAmount =
      data.paymentStatus === 'paid'
        ? total
        : data.paymentStatus === 'partial'
          ? data.paidAmount || 0
          : 0

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(mockStorage.invoices.length + 1).padStart(3, '0')}`

    // Get contact info
    const contact = mockStorage.contacts.find(c => c.id === data.contactId)

    const newInvoice = {
      id: String(mockStorage.invoices.length + 1),
      invoiceNumber,
      contactId: data.contactId,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
      contactEmail: contact?.email,
      contactCompany: contact?.company,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      status: data.status || 'draft',
      paymentStatus: data.paymentStatus || 'pending',
      notes: data.notes || '',
      dueDate: data.dueDate || undefined,
      paymentTerms: data.paymentTerms || 'Net 30',
      paidAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockStorage.invoices.push(newInvoice)
    return newInvoice
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.invoices.findIndex(i => i.id === id)
    if (index === -1) throw new Error('Invoice not found')

    // Recalculate if line items changed
    let updatedInvoice = { ...mockStorage.invoices[index], ...data }
    if (data.lineItems) {
      const lineItems = data.lineItems.map((item: any, idx: number) => ({
        id: item.id || String(idx + 1),
        ...item,
        total: item.quantity * item.unitPrice,
      }))
      const subtotal = lineItems.reduce((sum: number, item: any) => sum + item.total, 0)
      const taxRate = data.taxRate ?? updatedInvoice.taxRate
      const taxAmount = subtotal * taxRate
      const discount = data.discount ?? updatedInvoice.discount
      updatedInvoice = {
        ...updatedInvoice,
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        total: subtotal + taxAmount - discount,
      }
    } else if (data.taxRate !== undefined || data.discount !== undefined) {
      const subtotal = updatedInvoice.subtotal
      const taxRate = data.taxRate ?? updatedInvoice.taxRate
      const taxAmount = subtotal * taxRate
      const discount = data.discount ?? updatedInvoice.discount
      updatedInvoice = {
        ...updatedInvoice,
        taxRate,
        taxAmount,
        discount,
        total: subtotal + taxAmount - discount,
      }
    }

    // Update paid amount based on payment status
    if (data.paymentStatus === 'paid') {
      updatedInvoice.paidAmount = updatedInvoice.total
    } else if (data.paymentStatus === 'partial' && data.paidAmount !== undefined) {
      updatedInvoice.paidAmount = data.paidAmount
    } else if (data.paymentStatus === 'pending') {
      updatedInvoice.paidAmount = 0
    }

    updatedInvoice.updatedAt = new Date().toISOString()
    mockStorage.invoices[index] = updatedInvoice
    return updatedInvoice
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.invoices.findIndex(i => i.id === id)
    if (index === -1) throw new Error('Invoice not found')
    mockStorage.invoices.splice(index, 1)
    return { success: true }
  },

  send: async (id: string) => {
    await delay(500)
    const index = mockStorage.invoices.findIndex(i => i.id === id)
    if (index === -1) throw new Error('Invoice not found')

    const invoice = mockStorage.invoices[index]
    const contact = mockStorage.contacts.find(c => c.id === invoice.contactId)

    if (!contact?.email) {
      throw new Error('Contact does not have an email address')
    }

    // Update status to sent
    invoice.status = 'sent'
    invoice.updatedAt = new Date().toISOString()
    mockStorage.invoices[index] = invoice
    saveMockStorage()

    // Log mock email
    console.log('\n📧 =============== INVOICE EMAIL (Mock Mode) ===============')
    console.log(`To: ${contact.email}`)
    console.log(`From: noreply@jobdock.dev`)
    console.log(`Subject: Invoice ${invoice.invoiceNumber}`)
    console.log('---')
    console.log(`Hi ${contact.firstName},\n`)
    console.log(`Please find your invoice attached.\n`)
    console.log(`Invoice Number: ${invoice.invoiceNumber}`)
    console.log(`Total: $${invoice.total.toFixed(2)}`)
    console.log(`Due Date: ${invoice.dueDate || 'Upon Receipt'}`)
    console.log(`Payment Status: ${invoice.paymentStatus}`)
    console.log('\n[PDF Attachment: Invoice.pdf]')
    console.log('================================================\n')

    return {
      ...invoice,
      contactName: `${contact.firstName} ${contact.lastName}`,
      contactEmail: contact.email,
      contactCompany: contact.company,
    }
  },
}

// Mock Jobs Service
export const mockJobsService = {
  getAll: async (startDate?: Date, endDate?: Date) => {
    await delay(300)
    console.log('Fetching jobs from mockStorage, total jobs:', mockStorage.jobs.length)
    console.log('Jobs:', mockStorage.jobs)
    let jobs = mockStorage.jobs

    if (startDate || endDate) {
      jobs = jobs.filter(job => {
        const jobStart = new Date(job.startTime)
        if (startDate && jobStart < startDate) return false
        if (endDate && jobStart > endDate) return false
        return true
      })
    }

    return jobs
  },

  getById: async (id: string) => {
    await delay(200)
    const job = mockStorage.jobs.find(j => j.id === id)
    if (!job) throw new Error('Job not found')
    return job
  },

  create: async (data: any) => {
    await delay(400)
    // Get contact info
    const contact = mockStorage.contacts.find(c => c.id === data.contactId)

    // Log for debugging
    if (!contact) {
      console.warn(
        `Contact with ID ${data.contactId} not found. Available contacts:`,
        mockStorage.contacts.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))
      )
    }

    const service = data.serviceId ? mockStorage.services.find(s => s.id === data.serviceId) : null

    const newJob = {
      id: String(mockStorage.jobs.length + 1),
      title: data.title,
      description: data.description || '',
      contactId: data.contactId,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : '',
      contactEmail: contact?.email || '',
      contactPhone: contact?.phone || '',
      serviceId: data.serviceId,
      serviceName: service?.name,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status || 'scheduled',
      location: data.location || '',
      notes: data.notes || '',
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockStorage.jobs.push(newJob)
    saveMockStorage()
    return newJob
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.jobs.findIndex(j => j.id === id)
    if (index === -1) throw new Error('Job not found')

    const updatedJob = {
      ...mockStorage.jobs[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }

    // Update contact/service info if changed
    if (data.contactId) {
      const contact = mockStorage.contacts.find(c => c.id === data.contactId)
      if (contact) {
        updatedJob.contactName = `${contact.firstName} ${contact.lastName}`
        updatedJob.contactEmail = contact.email || ''
        updatedJob.contactPhone = contact.phone || ''
      } else {
        // If contact not found, clear the contact info
        updatedJob.contactName = ''
        updatedJob.contactEmail = ''
        updatedJob.contactPhone = ''
      }
    }

    if (data.serviceId) {
      const service = mockStorage.services.find(s => s.id === data.serviceId)
      if (service) {
        updatedJob.serviceName = service.name
      }
    }

    mockStorage.jobs[index] = updatedJob
    saveMockStorage()
    return updatedJob
  },

  delete: async (id: string, deleteAll?: boolean) => {
    await delay(300)
    console.log('Mock API: delete called with id:', id, 'deleteAll:', deleteAll)
    const jobIndex = mockStorage.jobs.findIndex(j => j.id === id)
    if (jobIndex === -1) throw new Error('Job not found')

    const job = mockStorage.jobs[jobIndex]
    console.log('Mock API: Found job:', job.title, 'recurrenceId:', job.recurrenceId)
    console.log('Mock API: Total jobs before delete:', mockStorage.jobs.length)

    if (deleteAll && job.recurrenceId) {
      // Delete all jobs with the same recurrenceId
      const jobsWithSameRecurrence = mockStorage.jobs.filter(
        j => j.recurrenceId === job.recurrenceId
      )
      console.log('Mock API: Found', jobsWithSameRecurrence.length, 'jobs with same recurrenceId')
      mockStorage.jobs = mockStorage.jobs.filter(j => j.recurrenceId !== job.recurrenceId)
    } else {
      console.log('Mock API: Deleting single job only')
      // Delete only this job
      mockStorage.jobs.splice(jobIndex, 1)
    }

    console.log('Mock API: Total jobs after delete:', mockStorage.jobs.length)
    saveMockStorage()
    return { success: true }
  },

  confirm: async (id: string) => {
    await delay(300)
    const job = mockStorage.jobs.find(j => j.id === id)
    if (!job) throw new Error('Job not found')
    if (job.status !== 'pending-confirmation') {
      throw new Error('Only pending jobs can be confirmed')
    }
    job.status = 'scheduled'
    job.updatedAt = new Date().toISOString()
    saveMockStorage()

    // Log confirmation email
    console.log('\n📧 =============== EMAIL (Mock Mode) ===============')
    console.log(`To: ${job.contactEmail}`)
    console.log(`From: noreply@jobdock.dev`)
    console.log(`Subject: Your booking has been confirmed - ${job.serviceName}`)
    console.log('---')
    console.log(`Hi ${job.contactName},\n`)
    console.log(`Great news! Your booking request has been confirmed.\n`)
    console.log(`Service: ${job.serviceName}`)
    console.log(
      `Date: ${new Date(job.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    )
    console.log(
      `Time: ${new Date(job.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    )
    console.log('\nWe look forward to seeing you!')
    console.log('================================================\n')

    return job
  },

  decline: async (id: string, payload?: { reason?: string }) => {
    await delay(300)
    const job = mockStorage.jobs.find(j => j.id === id)
    if (!job) throw new Error('Job not found')
    if (job.status !== 'pending-confirmation') {
      throw new Error('Only pending jobs can be declined')
    }
    job.status = 'cancelled'
    if (payload?.reason) {
      job.notes = `${job.notes ? job.notes + '\n' : ''}Declined: ${payload.reason}`
    }
    job.updatedAt = new Date().toISOString()
    saveMockStorage()

    // Log decline email
    console.log('\n📧 =============== EMAIL (Mock Mode) ===============')
    console.log(`To: ${job.contactEmail}`)
    console.log(`From: noreply@jobdock.dev`)
    console.log(`Subject: Booking request declined - ${job.serviceName}`)
    console.log('---')
    console.log(`Hi ${job.contactName},\n`)
    console.log(`Unfortunately, we're unable to accommodate your booking request for:\n`)
    console.log(`Service: ${job.serviceName}`)
    console.log(
      `Date: ${new Date(job.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    )
    console.log(
      `Time: ${new Date(job.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    )
    if (payload?.reason) {
      console.log(`\nReason: ${payload.reason}`)
    }
    console.log(
      '\nWe apologize for any inconvenience. Please feel free to try booking a different time slot.'
    )
    console.log('================================================\n')

    return job
  },
}

// Mock Services Service
export const mockServicesService = {
  getAll: async () => {
    await delay(300)
    return mockStorage.services
  },

  getById: async (id: string) => {
    await delay(200)
    const service = mockStorage.services.find(s => s.id === id)
    if (!service) throw new Error('Service not found')
    return service
  },

  create: async (data: any) => {
    await delay(400)
    const newService = {
      id: String(mockStorage.services.length + 1),
      name: data.name,
      description: data.description || '',
      duration: data.duration,
      price: data.price,
      isActive: data.isActive !== undefined ? data.isActive : true,
      availability: data.availability,
      bookingSettings: data.bookingSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockStorage.services.push(newService)
    saveMockStorage()
    return newService
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.services.findIndex(s => s.id === id)
    if (index === -1) throw new Error('Service not found')
    const updatedService = {
      ...mockStorage.services[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    mockStorage.services[index] = updatedService
    saveMockStorage()
    return updatedService
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.services.findIndex(s => s.id === id)
    if (index === -1) throw new Error('Service not found')
    mockStorage.services.splice(index, 1)
    saveMockStorage()
    return { success: true }
  },

  getBookingLink: async (id: string) => {
    await delay(200)
    const service = mockStorage.services.find(s => s.id === id)
    if (!service) throw new Error('Service not found')

    const baseUrl = window.location.origin
    return {
      serviceId: id,
      serviceName: service.name,
      publicLink: `${baseUrl}/book/${id}`,
      embedCode: `<iframe src="${baseUrl}/book/${id}" width="100%" height="600" frameborder="0"></iframe>`,
    }
  },

  getAvailability: async (id: string, startDate?: Date, endDate?: Date) => {
    console.log('MOCK getAvailability called for service:', id)
    await delay(300)
    const service = mockStorage.services.find(s => s.id === id)
    console.log('Found service in mock storage:', service)
    if (!service) throw new Error('Service not found')
    if (!service.isActive) throw new Error('Service is not active')

    // Generate mock available slots
    const now = new Date()
    const start = startDate || now
    const end = endDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    console.log('Generating slots from', start, 'to', end)

    const slots = []
    const currentDay = new Date(start)
    currentDay.setHours(0, 0, 0, 0)

    while (currentDay <= end) {
      const dayOfWeek = currentDay.getDay()
      const workingHours = service.availability?.workingHours?.find(
        (wh: any) => wh.dayOfWeek === dayOfWeek
      )

      if (workingHours && workingHours.isWorking) {
        const daySlots = []
        const [startHour, startMin] = workingHours.startTime.split(':').map(Number)
        const [endHour, endMin] = workingHours.endTime.split(':').map(Number)

        for (let hour = startHour; hour < endHour; hour++) {
          const slotStart = new Date(currentDay)
          slotStart.setHours(hour, 0, 0, 0)

          const slotEnd = new Date(slotStart)
          slotEnd.setMinutes(slotEnd.getMinutes() + service.duration)

          if (slotStart > now && slotEnd.getHours() <= endHour) {
            daySlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            })
          }
        }

        if (daySlots.length > 0) {
          slots.push({
            date: currentDay.toISOString().split('T')[0],
            slots: daySlots,
          })
        }
      }

      currentDay.setDate(currentDay.getDate() + 1)
    }

    console.log('Generated slots:', slots)
    const result = {
      serviceId: id,
      slots,
    }
    console.log('Returning availability result:', result)
    return result
  },

  bookSlot: async (id: string, payload: any) => {
    await delay(500)
    const service = mockStorage.services.find(s => s.id === id)
    if (!service) throw new Error('Service not found')
    if (!service.isActive) throw new Error('Service is not active')

    // Create or find contact
    let contact = mockStorage.contacts.find((c: any) => c.email === payload.contact?.email)
    if (!contact) {
      const nameParts = (payload.contact?.name || 'Guest').split(/\s+/)
      contact = {
        id: String(mockStorage.contacts.length + 1),
        firstName: nameParts[0] || 'Guest',
        lastName: nameParts.slice(1).join(' ') || '',
        email: payload.contact?.email || '',
        phone: payload.contact?.phone || '',
        company: payload.contact?.company || '',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockStorage.contacts.push(contact)
    }

    // Create job
    const startTime = new Date(payload.startTime)
    const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000)
    const requireConfirmation = service.bookingSettings?.requireConfirmation ?? false
    const initialStatus = requireConfirmation ? 'pending-confirmation' : 'scheduled'

    console.log('Service bookingSettings:', service.bookingSettings)
    console.log('requireConfirmation:', requireConfirmation)
    console.log('Setting job status to:', initialStatus)

    const newJob = {
      id: String(mockStorage.jobs.length + 1),
      title: `${service.name} with ${contact.firstName} ${contact.lastName}`.trim(),
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      contactEmail: contact.email,
      contactPhone: contact.phone,
      serviceId: service.id,
      serviceName: service.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: initialStatus,
      location: payload.location || '',
      notes: payload.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    mockStorage.jobs.push(newJob)
    saveMockStorage()

    // Simulate email notifications (log to console)
    const clientName = `${contact.firstName} ${contact.lastName}`.trim()
    const dateStr = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    console.log('\n📧 =============== EMAIL (Mock Mode) ===============')
    console.log(`To: ${contact.email}`)
    console.log(`From: noreply@jobdock.dev`)
    if (requireConfirmation) {
      console.log(`Subject: Booking request received - ${service.name}`)
      console.log('---')
      console.log(`Hi ${clientName},\n`)
      console.log(`We've received your booking request for:\n`)
      console.log(`Service: ${service.name}`)
      console.log(`Date: ${dateStr}`)
      console.log(`Time: ${timeStr}`)
      console.log(
        `\nYour request is pending confirmation. We'll send you another email once it's confirmed.`
      )
    } else {
      console.log(`Subject: Your booking is confirmed - ${service.name}`)
      console.log('---')
      console.log(`Hi ${clientName},\n`)
      console.log(`Your booking has been confirmed!\n`)
      console.log(`Service: ${service.name}`)
      console.log(`Date: ${dateStr}`)
      console.log(`Time: ${timeStr}`)
      console.log(`\nWe look forward to seeing you!`)
    }
    console.log('================================================\n')

    // Contractor notification
    console.log('\n📧 =============== EMAIL (Mock Mode) ===============')
    console.log(`To: jordan@westwavecreative.com`)
    console.log(`From: noreply@jobdock.dev`)
    console.log(`Subject: New booking ${requireConfirmation ? 'request' : ''} for ${service.name}`)
    console.log('---')
    console.log(`Hi Jordan,\n`)
    console.log(
      `You have a new booking${requireConfirmation ? ' request' : ''} for ${service.name}.\n`
    )
    console.log(`Client: ${clientName}`)
    console.log(`Email: ${contact.email}`)
    console.log(`Phone: ${contact.phone}`)
    console.log(`Service: ${service.name}`)
    console.log(`Date: ${dateStr}`)
    console.log(`Time: ${timeStr}`)
    if (requireConfirmation) {
      console.log(
        `\n⚠️ This booking requires your confirmation. Please log in to your dashboard to confirm or decline.`
      )
    }
    console.log('================================================\n')

    return newJob
  },
}

// Export all mock services
export const mockServices = {
  auth: mockAuthService,
  contacts: mockContactsService,
  quotes: mockQuotesService,
  invoices: mockInvoicesService,
  jobs: mockJobsService,
  services: mockServicesService,
  // Add more services as you build them
}
