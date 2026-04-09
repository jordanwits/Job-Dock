export interface SavedLineItem {
  id: string
  tenantId: string
  name: string
  normalizedName: string
  description: string
  defaultQuantity: number
  unitPrice: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateSavedLineItemData = {
  /** Omit to derive from `description` (create UI sends description only). */
  name?: string
  description?: string
  defaultQuantity?: number
  unitPrice?: number
}

export type UpdateSavedLineItemData = Partial<CreateSavedLineItemData> & { id: string }
