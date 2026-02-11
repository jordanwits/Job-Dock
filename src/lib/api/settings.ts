import { apiClient } from './client'

export interface TenantSettings {
  id: string
  tenantId: string
  companyDisplayName?: string
  tenantName?: string
  companySupportEmail?: string
  companyPhone?: string
  logoUrl?: string
  logoSignedUrl?: string
  invoiceEmailSubject: string
  invoiceEmailBody: string
  quoteEmailSubject: string
  quoteEmailBody: string
  invoicePdfTemplateKey?: string
  quotePdfTemplateKey?: string
  invoicePdfSignedUrl?: string
  quotePdfSignedUrl?: string
  updatedAt: string
  updatedByUserId?: string
}

export interface UpdateSettingsPayload {
  companyDisplayName?: string
  companySupportEmail?: string
  companyPhone?: string
  invoiceEmailSubject?: string
  invoiceEmailBody?: string
  quoteEmailSubject?: string
  quoteEmailBody?: string
}

export const settingsApi = {
  /**
   * Get current tenant settings
   */
  getSettings: async (): Promise<TenantSettings> => {
    const response = await apiClient.get('/settings')
    return response.data
  },

  /**
   * Update tenant settings
   */
  updateSettings: async (payload: UpdateSettingsPayload): Promise<TenantSettings> => {
    const response = await apiClient.put('/settings', payload)
    return response.data
  },

  /**
   * Upload company logo using pre-signed URL
   */
  uploadLogo: async (file: File): Promise<TenantSettings> => {
    // Step 1: Get pre-signed URL
    const { data: urlData } = await apiClient.post('/settings/get-upload-url', {
      type: 'logo',
      filename: file.name,
      contentType: file.type,
    })

    // Step 2: Upload directly to S3
    await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    // Step 3: Confirm upload to backend
    const response = await apiClient.post('/settings/confirm-upload', {
      key: urlData.key,
      type: 'logo',
    })
    return response.data
  },

  /**
   * Upload invoice PDF template using pre-signed URL
   */
  uploadInvoicePdf: async (file: File): Promise<TenantSettings> => {
    // Step 1: Get pre-signed URL
    const { data: urlData } = await apiClient.post('/settings/get-upload-url', {
      type: 'invoice-pdf',
      filename: file.name,
      contentType: file.type,
    })

    // Step 2: Upload directly to S3
    await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    // Step 3: Confirm upload to backend
    const response = await apiClient.post('/settings/confirm-upload', {
      key: urlData.key,
      type: 'invoice-pdf',
    })
    return response.data
  },

  /**
   * Upload quote PDF template using pre-signed URL
   */
  uploadQuotePdf: async (file: File): Promise<TenantSettings> => {
    // Step 1: Get pre-signed URL
    const { data: urlData } = await apiClient.post('/settings/get-upload-url', {
      type: 'quote-pdf',
      filename: file.name,
      contentType: file.type,
    })

    // Step 2: Upload directly to S3
    await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    // Step 3: Confirm upload to backend
    const response = await apiClient.post('/settings/confirm-upload', {
      key: urlData.key,
      type: 'quote-pdf',
    })
    return response.data
  },
}

