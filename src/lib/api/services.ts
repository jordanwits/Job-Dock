/**
 * API Service Layer
 * 
 * This file provides the real API service implementations.
 * Switch between mock and real services using environment variables.
 */

import apiClient from './client'
import { mockServices } from '../mock/api'
import type { Quote, CreateQuoteData } from '@/features/quotes/types/quote'
import type { Invoice, CreateInvoiceData } from '@/features/invoices/types/invoice'
import type { Job, CreateJobData } from '@/features/scheduling/types/job'
import type { Service, CreateServiceData } from '@/features/scheduling/types/service'

// Determine which services to use
const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true' || import.meta.env.DEV

// Real API implementations
const realAuthService = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password })
    return response.data
  },

  register: async (data: {
    email: string
    password: string
    name: string
    companyName: string
  }) => {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout')
    return response.data
  },

  resetPassword: async (email: string) => {
    const response = await apiClient.post('/auth/reset-password', { email })
    return response.data
  },
}

const realContactsService = {
  getAll: async () => {
    const response = await apiClient.get('/contacts')
    return response.data
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/contacts/${id}`)
    return response.data
  },

  create: async (data: any) => {
    const response = await apiClient.post('/contacts', data)
    return response.data
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`/contacts/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/contacts/${id}`)
    return response.data
  },
}

const realQuotesService = {
  getAll: async () => {
    const response = await apiClient.get('/quotes')
    return response.data
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/quotes/${id}`)
    return response.data
  },

  create: async (data: CreateQuoteData) => {
    const response = await apiClient.post('/quotes', data)
    return response.data
  },

  update: async (id: string, data: Partial<CreateQuoteData>) => {
    const response = await apiClient.put(`/quotes/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/quotes/${id}`)
    return response.data
  },
}

const realInvoicesService = {
  getAll: async () => {
    const response = await apiClient.get('/invoices')
    return response.data
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/invoices/${id}`)
    return response.data
  },

  create: async (data: CreateInvoiceData) => {
    const response = await apiClient.post('/invoices', data)
    return response.data
  },

  update: async (id: string, data: Partial<CreateInvoiceData>) => {
    const response = await apiClient.put(`/invoices/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/invoices/${id}`)
    return response.data
  },
}

const realJobsService = {
  getAll: async (startDate?: Date, endDate?: Date) => {
    const params: any = {}
    if (startDate) params.startDate = startDate.toISOString()
    if (endDate) params.endDate = endDate.toISOString()
    const response = await apiClient.get('/jobs', { params })
    return response.data
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/jobs/${id}`)
    return response.data
  },

  create: async (data: CreateJobData) => {
    const response = await apiClient.post('/jobs', data)
    return response.data
  },

  update: async (id: string, data: Partial<CreateJobData>) => {
    const response = await apiClient.put(`/jobs/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/jobs/${id}`)
    return response.data
  },
}

const realServicesService = {
  getAll: async () => {
    const response = await apiClient.get('/services')
    return response.data
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/services/${id}`)
    return response.data
  },

  create: async (data: CreateServiceData) => {
    const response = await apiClient.post('/services', data)
    return response.data
  },

  update: async (id: string, data: Partial<CreateServiceData>) => {
    const response = await apiClient.put(`/services/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/services/${id}`)
    return response.data
  },

  getBookingLink: async (id: string) => {
    const response = await apiClient.get(`/services/${id}/booking-link`)
    return response.data
  },
}

// Export services (mock or real based on environment)
export const authService = useMockData ? mockServices.auth : realAuthService
export const contactsService = useMockData
  ? mockServices.contacts
  : realContactsService
export const quotesService = useMockData ? mockServices.quotes : realQuotesService
export const invoicesService = useMockData ? mockServices.invoices : realInvoicesService
export const jobsService = useMockData ? mockServices.jobs : realJobsService
export const servicesService = useMockData ? mockServices.services : realServicesService

// Add more services as you build them
export const services = {
  auth: authService,
  contacts: contactsService,
  quotes: quotesService,
  invoices: invoicesService,
  jobs: jobsService,
  services: servicesService,
}

