/**
 * Mock API Service Layer
 * 
 * This file provides mock implementations of all API services.
 * Replace these with real API calls when backend is ready.
 * 
 * The structure matches the real API structure, making the transition seamless.
 */

// Mock delay to simulate network requests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock data storage (in-memory)
const mockStorage = {
  contacts: [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0101',
      company: 'ABC Construction',
      jobTitle: 'Project Manager',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
      tags: ['contractor', 'premium'],
      notes: 'Regular client, prefers email communication',
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+1-555-0102',
      company: 'XYZ Builders',
      jobTitle: 'Owner',
      address: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA',
      tags: ['builder'],
      notes: 'Interested in new projects',
      status: 'lead',
      createdAt: '2024-01-16T14:30:00Z',
      updatedAt: '2024-01-16T14:30:00Z',
    },
    {
      id: '3',
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike.j@contractors.com',
      phone: '+1-555-0103',
      company: 'Johnson & Sons',
      jobTitle: 'CEO',
      address: '789 Pine Rd',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA',
      tags: ['contractor', 'vip'],
      notes: 'Long-term partner',
      status: 'active',
      createdAt: '2024-01-10T08:00:00Z',
      updatedAt: '2024-01-20T09:00:00Z',
    },
  ],
  quotes: [
    {
      id: '1',
      quoteNumber: 'QT-2024-001',
      contactId: '1',
      contactName: 'John Doe',
      contactEmail: 'john.doe@example.com',
      contactCompany: 'ABC Construction',
      lineItems: [
        {
          id: '1',
          description: 'Kitchen Renovation - Labor',
          quantity: 40,
          unitPrice: 75,
          total: 3000,
        },
        {
          id: '2',
          description: 'Kitchen Renovation - Materials',
          quantity: 1,
          unitPrice: 5000,
          total: 5000,
        },
      ],
      subtotal: 8000,
      taxRate: 0.08,
      taxAmount: 640,
      discount: 0,
      total: 8640,
      status: 'sent',
      notes: 'Valid for 30 days',
      validUntil: '2024-02-15T00:00:00Z',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      quoteNumber: 'QT-2024-002',
      contactId: '2',
      contactName: 'Jane Smith',
      contactEmail: 'jane.smith@example.com',
      contactCompany: 'XYZ Builders',
      lineItems: [
        {
          id: '3',
          description: 'Bathroom Remodel',
          quantity: 1,
          unitPrice: 12000,
          total: 12000,
        },
      ],
      subtotal: 12000,
      taxRate: 0.08,
      taxAmount: 960,
      discount: 500,
      total: 12460,
      status: 'draft',
      notes: 'Pending review',
      createdAt: '2024-01-20T14:00:00Z',
      updatedAt: '2024-01-20T14:00:00Z',
    },
  ],
  invoices: [
    {
      id: '1',
      invoiceNumber: 'INV-2024-001',
      contactId: '1',
      contactName: 'John Doe',
      contactEmail: 'john.doe@example.com',
      contactCompany: 'ABC Construction',
      lineItems: [
        {
          id: '1',
          description: 'Kitchen Renovation - Labor',
          quantity: 40,
          unitPrice: 75,
          total: 3000,
        },
        {
          id: '2',
          description: 'Kitchen Renovation - Materials',
          quantity: 1,
          unitPrice: 5000,
          total: 5000,
        },
      ],
      subtotal: 8000,
      taxRate: 0.08,
      taxAmount: 640,
      discount: 0,
      total: 8640,
      status: 'sent',
      paymentStatus: 'pending',
      notes: 'Payment due within 30 days',
      dueDate: '2024-02-15T00:00:00Z',
      paymentTerms: 'Net 30',
      paidAmount: 0,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      invoiceNumber: 'INV-2024-002',
      contactId: '2',
      contactName: 'Jane Smith',
      contactEmail: 'jane.smith@example.com',
      contactCompany: 'XYZ Builders',
      lineItems: [
        {
          id: '3',
          description: 'Bathroom Remodel',
          quantity: 1,
          unitPrice: 12000,
          total: 12000,
        },
      ],
      subtotal: 12000,
      taxRate: 0.08,
      taxAmount: 960,
      discount: 500,
      total: 12460,
      status: 'sent',
      paymentStatus: 'paid',
      notes: 'Payment received',
      dueDate: '2024-01-25T00:00:00Z',
      paymentTerms: 'Net 30',
      paidAmount: 12460,
      createdAt: '2024-01-20T14:00:00Z',
      updatedAt: '2024-01-22T10:00:00Z',
    },
  ],
  schedules: [],
  jobs: [
    {
      id: '1',
      title: 'Kitchen Renovation Consultation',
      description: 'Initial consultation for kitchen renovation project',
      contactId: '1',
      contactName: 'John Doe',
      contactEmail: 'john.doe@example.com',
      contactPhone: '+1-555-0101',
      serviceId: '1',
      serviceName: 'Consultation',
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // +1 hour
      status: 'scheduled',
      location: '123 Main St, New York, NY',
      notes: 'Customer wants to discuss timeline and budget',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Bathroom Remodel - Site Visit',
      description: 'Site visit to assess bathroom remodeling needs',
      contactId: '2',
      contactName: 'Jane Smith',
      contactEmail: 'jane.smith@example.com',
      contactPhone: '+1-555-0102',
      serviceId: '2',
      serviceName: 'Site Visit',
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(), // +90 minutes
      status: 'scheduled',
      location: '456 Oak Ave, Los Angeles, CA',
      notes: 'Bring measuring tools',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  services: [
    {
      id: '1',
      name: 'Consultation',
      description: 'Initial consultation to discuss project requirements',
      duration: 60,
      price: 100,
      isActive: true,
      availability: {
        workingHours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isWorking: true },
          { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isWorking: false },
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isWorking: false },
        ],
        bufferTime: 15,
        advanceBookingDays: 30,
        sameDayBooking: true,
      },
      bookingSettings: {
        requireConfirmation: false,
        allowCancellation: true,
        cancellationHours: 24,
        maxBookingsPerSlot: 1,
        requireContactInfo: true,
        bookingFormFields: ['name', 'email', 'phone', 'notes'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Site Visit',
      description: 'On-site visit to assess project requirements',
      duration: 90,
      price: 150,
      isActive: true,
      availability: {
        workingHours: [
          { dayOfWeek: 1, startTime: '10:00', endTime: '16:00', isWorking: true },
          { dayOfWeek: 2, startTime: '10:00', endTime: '16:00', isWorking: true },
          { dayOfWeek: 3, startTime: '10:00', endTime: '16:00', isWorking: true },
          { dayOfWeek: 4, startTime: '10:00', endTime: '16:00', isWorking: true },
          { dayOfWeek: 5, startTime: '10:00', endTime: '16:00', isWorking: true },
          { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isWorking: false },
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isWorking: false },
        ],
        bufferTime: 30,
        advanceBookingDays: 60,
        sameDayBooking: false,
      },
      bookingSettings: {
        requireConfirmation: true,
        allowCancellation: true,
        cancellationHours: 48,
        maxBookingsPerSlot: 1,
        requireContactInfo: true,
        bookingFormFields: ['name', 'email', 'phone', 'address', 'notes'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
}

// Mock Auth Service
export const mockAuthService = {
  login: async (email: string, password: string) => {
    await delay(500)
    // Trim whitespace and normalize email to lowercase for comparison
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()
    
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
    const contact = mockStorage.contacts.find((c) => c.id === id)
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
    return newContact
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.contacts.findIndex((c) => c.id === id)
    if (index === -1) throw new Error('Contact not found')
    const updatedContact = {
      ...mockStorage.contacts[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    mockStorage.contacts[index] = updatedContact
    return updatedContact
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.contacts.findIndex((c) => c.id === id)
    if (index === -1) throw new Error('Contact not found')
    mockStorage.contacts.splice(index, 1)
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
    const quote = mockStorage.quotes.find((q) => q.id === id)
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
    const index = mockStorage.quotes.findIndex((q) => q.id === id)
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
    const index = mockStorage.quotes.findIndex((q) => q.id === id)
    if (index === -1) throw new Error('Quote not found')
    mockStorage.quotes.splice(index, 1)
    return { success: true }
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
    const invoice = mockStorage.invoices.find((i) => i.id === id)
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
    const paidAmount = data.paymentStatus === 'paid' ? total : data.paymentStatus === 'partial' ? (data.paidAmount || 0) : 0

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(mockStorage.invoices.length + 1).padStart(3, '0')}`
    
    // Get contact info
    const contact = mockStorage.contacts.find((c) => c.id === data.contactId)
    
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
    const index = mockStorage.invoices.findIndex((i) => i.id === id)
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
    const index = mockStorage.invoices.findIndex((i) => i.id === id)
    if (index === -1) throw new Error('Invoice not found')
    mockStorage.invoices.splice(index, 1)
    return { success: true }
  },
}

// Mock Jobs Service
export const mockJobsService = {
  getAll: async (startDate?: Date, endDate?: Date) => {
    await delay(300)
    let jobs = mockStorage.jobs
    
    if (startDate || endDate) {
      jobs = jobs.filter((job) => {
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
    const job = mockStorage.jobs.find((j) => j.id === id)
    if (!job) throw new Error('Job not found')
    return job
  },

  create: async (data: any) => {
    await delay(400)
    // Get contact info
    const contact = mockStorage.contacts.find((c) => c.id === data.contactId)
    const service = data.serviceId ? mockStorage.services.find((s) => s.id === data.serviceId) : null
    
    const newJob = {
      id: String(mockStorage.jobs.length + 1),
      title: data.title,
      description: data.description || '',
      contactId: data.contactId,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown',
      contactEmail: contact?.email,
      contactPhone: contact?.phone,
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
    return newJob
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.jobs.findIndex((j) => j.id === id)
    if (index === -1) throw new Error('Job not found')
    
    const updatedJob = {
      ...mockStorage.jobs[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    
    // Update contact/service info if changed
    if (data.contactId) {
      const contact = mockStorage.contacts.find((c) => c.id === data.contactId)
      if (contact) {
        updatedJob.contactName = `${contact.firstName} ${contact.lastName}`
        updatedJob.contactEmail = contact.email
        updatedJob.contactPhone = contact.phone
      }
    }
    
    if (data.serviceId) {
      const service = mockStorage.services.find((s) => s.id === data.serviceId)
      if (service) {
        updatedJob.serviceName = service.name
      }
    }
    
    mockStorage.jobs[index] = updatedJob
    return updatedJob
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.jobs.findIndex((j) => j.id === id)
    if (index === -1) throw new Error('Job not found')
    mockStorage.jobs.splice(index, 1)
    return { success: true }
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
    const service = mockStorage.services.find((s) => s.id === id)
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
    return newService
  },

  update: async (id: string, data: any) => {
    await delay(400)
    const index = mockStorage.services.findIndex((s) => s.id === id)
    if (index === -1) throw new Error('Service not found')
    const updatedService = {
      ...mockStorage.services[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    mockStorage.services[index] = updatedService
    return updatedService
  },

  delete: async (id: string) => {
    await delay(300)
    const index = mockStorage.services.findIndex((s) => s.id === id)
    if (index === -1) throw new Error('Service not found')
    mockStorage.services.splice(index, 1)
    return { success: true }
  },

  getBookingLink: async (id: string) => {
    await delay(200)
    const service = mockStorage.services.find((s) => s.id === id)
    if (!service) throw new Error('Service not found')
    
    const baseUrl = window.location.origin
    return {
      serviceId: id,
      serviceName: service.name,
      publicLink: `${baseUrl}/book/${id}`,
      embedCode: `<iframe src="${baseUrl}/book/${id}" width="100%" height="600" frameborder="0"></iframe>`,
    }
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

