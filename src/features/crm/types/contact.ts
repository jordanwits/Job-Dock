export interface Contact {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  company?: string
  jobTitle?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  tags?: string[]
  notes?: string
  status: 'active' | 'inactive' | 'lead'
  createdAt: string
  updatedAt: string
}

export interface CreateContactData {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  company?: string
  jobTitle?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  tags?: string[]
  notes?: string
  status?: 'active' | 'inactive' | 'lead'
}

export interface UpdateContactData extends Partial<CreateContactData> {
  id: string
}

export type ContactStatus = 'active' | 'inactive' | 'lead'

