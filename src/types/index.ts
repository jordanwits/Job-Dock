// Global type definitions will go here

export interface User {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
}

export interface Tenant {
  id: string
  name: string
  subdomain: string
  createdAt: string
}

