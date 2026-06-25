import { useEffect, useMemo, useState } from 'react'
import { useContactStore } from '../store/contactStore'
import ContactCard from './ContactCard'
import { phoneMatches } from '@/lib/utils/phone'
import { contactsService } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import type { Contact } from '../types/contact'
import {
  Alert,
  AppButton,
  AppModal,
  AlertIcon,
  Avatar,
  CardsIcon,
  Dot,
  EmptyState,
  ListIcon,
  SearchIcon,
  SelectCircle,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
  TrashIcon,
  UsersIcon,
} from './crmUi'
import { CONTACT_STATUS, type Tone } from './contactStatus'

interface ContactListProps {
  onCreateClick?: () => void
}

type ViewMode = 'status' | 'alphabetical' | 'dateEntered'
type DisplayMode = 'cards' | 'list'

const ContactList = ({ onCreateClick }: ContactListProps) => {
  const {
    contacts,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    fetchContacts,
    setSearchQuery,
    setStatusFilter,
    setSelectedContact,
    clearError,
  } = useContactStore()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('crm-view-mode')
    return (saved as ViewMode) || 'alphabetical'
  })
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('crm-display-mode')
    return (saved as DisplayMode) || 'cards'
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  useEffect(() => {
    setStatusFilter('all')
  }, [setStatusFilter])

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('crm-view-mode', viewMode)
  }, [viewMode])

  // Persist display mode preference
  useEffect(() => {
    localStorage.setItem('crm-display-mode', displayMode)
  }, [displayMode])

  // Base filtered list - applies search and (for non-status views) statusFilter
  const baseFilteredContacts = useMemo(() => {
    let filtered = contacts

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (contact) =>
          contact.firstName.toLowerCase().includes(query) ||
          contact.lastName.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          phoneMatches(searchQuery, contact.phone) ||
          contact.company?.toLowerCase().includes(query)
      )
    }

    // Apply status filter only for non-status view modes
    if (viewMode !== 'status' && statusFilter !== 'all') {
      filtered = filtered.filter((contact) => contact.status === statusFilter)
    }

    return filtered
  }, [contacts, searchQuery, statusFilter, viewMode])

  // Sorted list for alphabetical and dateEntered views
  const sortedContacts = useMemo(() => {
    const sorted = [...baseFilteredContacts]

    if (viewMode === 'alphabetical') {
      sorted.sort((a, b) => {
        const lastNameA = (a.lastName || '').toLowerCase()
        const lastNameB = (b.lastName || '').toLowerCase()
        const lastNameCompare = lastNameA.localeCompare(lastNameB)
        if (lastNameCompare !== 0) return lastNameCompare
        return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase())
      })
    } else if (viewMode === 'dateEntered') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return sorted
  }, [baseFilteredContacts, viewMode])

  // Grouped contacts for status board view
  const { leadContacts, customerContacts, inactiveContacts } = useMemo(() => {
    if (viewMode !== 'status') {
      return { leadContacts: [], customerContacts: [], inactiveContacts: [] }
    }

    // For status view, apply only search filter (not statusFilter)
    let searchFiltered = contacts

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      searchFiltered = contacts.filter(
        (contact) =>
          contact.firstName.toLowerCase().includes(query) ||
          contact.lastName.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          phoneMatches(searchQuery, contact.phone) ||
          contact.company?.toLowerCase().includes(query)
      )
    }

    // Sort each group by last name, then first name
    const sortByLastName = (a: typeof contacts[0], b: typeof contacts[0]) => {
      const lastNameCompare = (a.lastName || '').toLowerCase().localeCompare((b.lastName || '').toLowerCase())
      if (lastNameCompare !== 0) return lastNameCompare
      return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase())
    }

    return {
      leadContacts: searchFiltered.filter((c) => c.status === 'lead').sort(sortByLastName),
      customerContacts: searchFiltered.filter((c) => c.status === 'customer').sort(sortByLastName),
      inactiveContacts: searchFiltered.filter((c) => c.status === 'inactive').sort(sortByLastName),
    }
  }, [contacts, searchQuery, viewMode])

  // Get the appropriate list for display based on view mode
  const displayContacts = viewMode === 'status'
    ? [...leadContacts, ...customerContacts, ...inactiveContacts]
    : sortedContacts

  // Handle bulk delete
  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true)
      const idsToDelete = Array.from(selectedIds)
      const errors: string[] = []

      // Delete contacts in batches of 5 to balance speed and reliability
      const BATCH_SIZE = 5
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          // Call API directly to avoid UI updates during deletion
          batch.map(id => contactsService.delete(id))
        )

        // Track which ones failed
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const failedId = batch[index]
            console.error(`Failed to delete contact ${failedId}:`, result.reason)
            errors.push(failedId)
          }
        })
      }

      // Refresh the entire list once at the end to prevent flashing
      await fetchContacts()

      // Only clear successfully deleted contacts
      if (errors.length > 0) {
        // Keep the failed IDs selected for retry
        setSelectedIds(new Set(errors))
        alert(`${idsToDelete.length - errors.length} contact(s) deleted successfully. ${errors.length} contact(s) failed - they remain selected for retry.`)
      } else {
        setSelectedIds(new Set())
      }
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error deleting contacts:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Toggle selection for a contact
  const toggleSelection = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // Select all/none
  const toggleSelectAll = () => {
    if (selectedIds.size === displayContacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayContacts.map(c => c.id)))
    }
  }

  if (error) {
    return (
      <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
        <p>{error}</p>
        <button
          onClick={() => {
            clearError()
            fetchContacts()
          }}
          className="mt-1.5 font-semibold underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <TextField
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            aria-label="Search contacts"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="w-full sm:w-[230px]">
            <SelectField
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              aria-label="Sort contacts"
              options={[
                { value: 'dateEntered', label: 'Date entered (newest first)' },
                { value: 'alphabetical', label: 'Alphabetical (A–Z)' },
                { value: 'status', label: 'By status' },
              ]}
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <SelectField
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'all' | 'customer' | 'inactive' | 'lead' | 'prospect' | 'contact'
                )
              }
              disabled={viewMode === 'status'}
              aria-label="Filter by status"
              helperText={viewMode === 'status' ? 'Not available in status view' : undefined}
              options={[
                { value: 'all', label: 'All status' },
                { value: 'lead', label: 'Lead' },
                { value: 'prospect', label: 'Prospect' },
                { value: 'customer', label: 'Customer' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'contact', label: 'Contact' },
              ]}
            />
          </div>
          {viewMode !== 'status' && (
            <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
              <button
                onClick={() => setDisplayMode('cards')}
                className={cn(
                  'flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  displayMode === 'cards'
                    ? 'bg-surface text-accent-strong shadow-card'
                    : 'text-ink-subtle hover:text-ink'
                )}
                title="Card view"
                aria-label="Card view"
                aria-pressed={displayMode === 'cards'}
              >
                <CardsIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={cn(
                  'flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  displayMode === 'list'
                    ? 'bg-surface text-accent-strong shadow-card'
                    : 'text-ink-subtle hover:text-ink'
                )}
                title="List view"
                aria-label="List view"
                aria-pressed={displayMode === 'list'}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex min-h-[2.25rem] items-center justify-between">
        <div className="text-sm text-ink-muted">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-accent-strong">
              <span className="font-mono tabular-nums">{selectedIds.size}</span> selected
            </span>
          ) : (
            <>
              <span className="font-mono tabular-nums text-ink">{displayContacts.length}</span>{' '}
              {displayContacts.length === 1 ? 'contact' : 'contacts'}
            </>
          )}
        </div>
        {selectedIds.size > 0 && (
          <AppButton variant="dangerGhost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            <TrashIcon className="h-4 w-4" />
            Delete selected ({selectedIds.size})
          </AppButton>
        )}
      </div>

      {/* Delete confirmation */}
      <AppModal
        isOpen={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        title={`Delete ${selectedIds.size} contact${selectedIds.size !== 1 ? 's' : ''}?`}
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleBulkDelete} isLoading={isDeleting} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            This action cannot be undone. All associated data will be permanently removed.
          </p>
        </div>
      </AppModal>

      {/* Contact list */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-muted">
          <Spinner className="text-accent-strong" />
          Loading contacts...
        </div>
      ) : displayContacts.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-7 w-7" />}
          title={searchQuery || statusFilter !== 'all' ? 'No contacts match your filters.' : 'No contacts yet. Add your first one to get started.'}
          action={
            !searchQuery && statusFilter === 'all' && onCreateClick ? (
              <AppButton onClick={onCreateClick} className="mt-1">
                Add your first contact
              </AppButton>
            ) : undefined
          }
        />
      ) : viewMode === 'status' ? (
        <StatusBoard
          columns={[
            { key: 'lead', title: 'Lead', tone: CONTACT_STATUS.lead.tone, contacts: leadContacts, empty: 'No leads yet' },
            { key: 'customer', title: 'Customer', tone: CONTACT_STATUS.customer.tone, contacts: customerContacts, empty: 'No customers' },
            { key: 'inactive', title: 'Inactive', tone: CONTACT_STATUS.inactive.tone, contacts: inactiveContacts, empty: 'No inactive contacts' },
          ]}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
        />
      ) : displayMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isSelected={selectedIds.has(contact.id)}
              onToggleSelect={toggleSelection}
            />
          ))}
        </div>
      ) : (
        <ContactTable
          contacts={displayContacts}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={setSelectedContact}
        />
      )}
    </div>
  )
}

/* ── Status board ─────────────────────────────────────────────────────── */
function StatusBoard({
  columns,
  selectedIds,
  onToggleSelect,
}: {
  columns: { key: string; title: string; tone: Tone; contacts: Contact[]; empty: string }[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, event: React.MouseEvent) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {columns.map((col) => (
        <div key={col.key} className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Dot tone={col.tone} />
              {col.title}
            </h3>
            <span className="font-mono text-sm tabular-nums text-ink-subtle">{col.contacts.length}</span>
          </div>
          {col.contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-subtle">{col.empty}</p>
          ) : (
            <div className="space-y-4">
              {col.contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedIds.has(contact.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Table view ───────────────────────────────────────────────────────── */
function ContactTable({
  contacts,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
}: {
  contacts: Contact[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, event: React.MouseEvent) => void
  onToggleSelectAll: () => void
  onRowClick: (contact: Contact) => void
}) {
  const allSelected = selectedIds.size === contacts.length && contacts.length > 0
  const thCls = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle'
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <th className="w-12 px-4 py-3">
                <SelectCircle
                  selected={allSelected}
                  onClick={(e) => { e.stopPropagation(); onToggleSelectAll() }}
                  label="Select all"
                  className="mx-auto"
                />
              </th>
              <th className={thCls}>Name</th>
              <th className={cn(thCls, 'hidden md:table-cell')}>Company</th>
              <th className={cn(thCls, 'hidden sm:table-cell')}>Email</th>
              <th className={cn(thCls, 'hidden lg:table-cell')}>Phone</th>
              <th className={thCls}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {contacts.map((contact) => {
              const status = CONTACT_STATUS[contact.status] ?? CONTACT_STATUS.contact
              return (
                <tr
                  key={contact.id}
                  className="cursor-pointer bg-surface transition-colors hover:bg-surface-hover"
                  onClick={() => onRowClick(contact)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <SelectCircle
                      selected={selectedIds.has(contact.id)}
                      onClick={(e) => onToggleSelect(contact.id, e)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" />
                      <span className="text-sm font-medium text-ink">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted md:table-cell">
                    {contact.company || <span className="text-ink-subtle">—</span>}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted sm:table-cell">
                    <div className="max-w-[220px] truncate">{contact.email || <span className="text-ink-subtle">—</span>}</div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted lg:table-cell">
                    {contact.phone ? <span className="font-mono tabular-nums">{contact.phone}</span> : <span className="text-ink-subtle">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ContactList
