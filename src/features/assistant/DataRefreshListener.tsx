import { useEffect } from 'react'
import { onDataChanged, type DataEntity } from './dataEvents'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { useServiceStore } from '@/features/scheduling/store/serviceStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'

/**
 * Refetches the relevant Zustand store whenever data changes (e.g. the AI
 * assistant creates/edits/deletes something), so the calendar and list views
 * update live without a manual reload. Mounted once in AppLayout.
 */
export function DataRefreshListener() {
  useEffect(() => {
    return onDataChanged((entity: DataEntity) => {
      switch (entity) {
        case 'contacts':
          void useContactStore.getState().fetchContacts()
          break
        case 'jobs':
          void useJobStore.getState().fetchJobs()
          break
        case 'quotes':
          void useQuoteStore.getState().fetchQuotes()
          break
        case 'invoices':
          void useInvoiceStore.getState().fetchInvoices()
          break
        case 'services':
          void useServiceStore.getState().fetchServices()
          break
      }
    })
  }, [])

  return null
}
