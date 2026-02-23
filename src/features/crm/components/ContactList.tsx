import { useEffect, useMemo, useState } from 'react'
import { useContactStore } from '../store/contactStore'
import ContactCard from './ContactCard'
import { Button, Input, Select } from '@/components/ui'
import { phoneMatches } from '@/lib/utils/phone'
import { contactsService } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

interface ContactListProps {
  onCreateClick?: () => void
}

type ViewMode = 'status' | 'alphabetical' | 'dateEntered'
type DisplayMode = 'cards' | 'list'

const ContactList = ({ onCreateClick }: ContactListProps) => {
  const { theme } = useTheme()
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
    deleteContact,
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
      <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
        <p className="text-sm text-red-500">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearError()
            fetchContacts()
          }}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            options={[
              { value: 'dateEntered', label: 'Date entered (newest first)' },
              { value: 'alphabetical', label: 'Alphabetical (A–Z)' },
              { value: 'status', label: 'By status (Lead / Customer / Inactive)' },
            ]}
            className="w-full sm:w-auto min-w-[200px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'customer' | 'inactive' | 'lead' | 'prospect' | 'contact'
              )
            }
            disabled={viewMode === 'status'}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'lead', label: 'Lead' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'customer', label: 'Customer' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'contact', label: 'Contact' },
            ]}
            helperText={viewMode === 'status' ? 'Status filter is not available in status board view' : undefined}
            className="w-full sm:w-auto min-w-[140px]"
          />
          {viewMode !== 'status' && (
            <div className={cn(
              "flex gap-1 border rounded-lg p-1",
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}>
              <button
                onClick={() => setDisplayMode('cards')}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  displayMode === 'cards'
                    ? 'bg-primary-gold text-primary-dark'
                    : theme === 'dark'
                      ? 'text-primary-light hover:bg-primary-blue/20'
                      : 'text-primary-lightText hover:bg-gray-100'
                )}
                title="Card View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  displayMode === 'list'
                    ? 'bg-primary-gold text-primary-dark'
                    : theme === 'dark'
                      ? 'text-primary-light hover:bg-primary-blue/20'
                      : 'text-primary-lightText hover:bg-gray-100'
                )}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Count and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className={cn(
          "text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-gold">
              {selectedIds.size} selected
            </span>
          ) : (
            `${displayContacts.length} contact${displayContacts.length !== 1 ? 's' : ''} found`
          )}
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className={cn(
            "border rounded-lg p-6 max-w-md w-full mx-4",
            theme === 'dark'
              ? 'bg-primary-dark border-red-500/30'
              : 'bg-white border-red-300'
          )} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-400 mb-2">Delete {selectedIds.size} Contact{selectedIds.size !== 1 ? 's' : ''}?</h3>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>
                  This action cannot be undone. All associated data will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className={cn(
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>Loading contacts...</p>
        </div>
      ) : displayContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className={cn(
            "mb-4",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            {searchQuery || statusFilter !== 'all'
              ? 'No contacts match your filters'
              : 'No contacts yet'}
          </p>
          {!searchQuery && statusFilter === 'all' && onCreateClick && (
            <Button variant="primary" onClick={onCreateClick}>Add Your First Contact</Button>
          )}
        </div>
      ) : viewMode === 'status' ? (
        // Status Board View - Three Columns
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Column */}
          <div className="space-y-4">
            <div className={cn(
              "flex items-center justify-between pb-2 border-b",
              theme === 'dark' ? 'border-primary-gold/30' : 'border-gray-200/20'
            )}>
              <h3 className="text-lg font-semibold text-primary-gold">Lead</h3>
              <span className={cn(
                "text-sm",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>{leadContacts.length}</span>
            </div>
            {leadContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>No leads yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leadContacts.map((contact) => (
                  <ContactCard 
                    key={contact.id} 
                    contact={contact}
                    isSelected={selectedIds.has(contact.id)}
                    onToggleSelect={toggleSelection}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Customer Column */}
          <div className="space-y-4">
            <div className={cn(
              "flex items-center justify-between pb-2 border-b",
              theme === 'dark' ? 'border-green-500/30' : 'border-gray-200/20'
            )}>
              <h3 className="text-lg font-semibold text-green-400">Customer</h3>
              <span className={cn(
                "text-sm",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>{customerContacts.length}</span>
            </div>
            {customerContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>No customers</p>
              </div>
            ) : (
              <div className="space-y-4">
                {customerContacts.map((contact) => (
                  <ContactCard 
                    key={contact.id} 
                    contact={contact}
                    isSelected={selectedIds.has(contact.id)}
                    onToggleSelect={toggleSelection}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Inactive Column */}
          <div className="space-y-4">
            <div className={cn(
              "flex items-center justify-between pb-2 border-b",
              theme === 'dark' ? 'border-gray-500/30' : 'border-gray-200/20'
            )}>
              <h3 className={cn(
                "text-lg font-semibold",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>Inactive</h3>
              <span className={cn(
                "text-sm",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>{inactiveContacts.length}</span>
            </div>
            {inactiveContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>No inactive contacts</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inactiveContacts.map((contact) => (
                  <ContactCard 
                    key={contact.id} 
                    contact={contact}
                    isSelected={selectedIds.has(contact.id)}
                    onToggleSelect={toggleSelection}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : displayMode === 'cards' ? (
        // Card Grid Layout
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        // List Layout
        <div className={cn(
          "rounded-lg border overflow-hidden",
          theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={cn(
                "border-b",
                theme === 'dark'
                  ? 'bg-primary-dark-secondary border-primary-blue'
                  : 'bg-gray-50 border-gray-200/20'
              )}>
                <tr>
                  <th className="px-4 py-3 w-12">
                    <div 
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto",
                        selectedIds.size === displayContacts.length && displayContacts.length > 0
                          ? "bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50" 
                          : theme === 'dark'
                            ? "border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10"
                            : "border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-gray-100"
                      )}
                    >
                      {selectedIds.size === displayContacts.length && displayContacts.length > 0 && (
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                        )} />
                      )}
                    </div>
                  </th>
                  <th className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    Name
                  </th>
                  <th className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    Company
                  </th>
                  <th className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    Email
                  </th>
                  <th className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    Phone
                  </th>
                  <th className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y",
                theme === 'dark' ? 'divide-primary-blue' : 'divide-gray-200/20'
              )}>
                {displayContacts.map((contact) => {
                  const statusColors = {
                    lead: theme === 'dark'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-blue-100 text-blue-700 border-blue-300',
                    prospect: theme === 'dark'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'bg-purple-100 text-purple-700 border-purple-300',
                    customer: theme === 'dark'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-green-100 text-green-700 border-green-300',
                    inactive: theme === 'dark'
                      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      : 'bg-gray-200 text-gray-700 border-gray-400',
                    contact: theme === 'dark'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-300',
                  }
                  
                  return (
                    <tr 
                      key={contact.id} 
                      className={cn(
                        "transition-colors cursor-pointer",
                        theme === 'dark'
                          ? 'bg-primary-dark hover:bg-primary-dark/50'
                          : 'bg-white hover:bg-gray-50'
                      )}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div 
                          onClick={(e) => toggleSelection(contact.id, e)}
                          className={cn(
                            "w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto",
                            selectedIds.has(contact.id)
                              ? "bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50" 
                              : theme === 'dark'
                                ? "border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10"
                                : "border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-gray-100"
                          )}
                        >
                          {selectedIds.has(contact.id) && (
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                            )} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center font-semibold",
                            theme === 'dark'
                              ? 'bg-primary-blue text-primary-gold'
                              : 'bg-primary-blue text-primary-gold'
                          )}>
                            {contact.firstName.charAt(0)}{contact.lastName.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <div className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                            )}>
                              {contact.firstName} {contact.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={cn(
                        "px-4 py-3 whitespace-nowrap text-sm hidden md:table-cell",
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}>
                        {contact.company || '-'}
                      </td>
                      <td className={cn(
                        "px-4 py-3 whitespace-nowrap text-sm hidden sm:table-cell",
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}>
                        <div className="truncate max-w-[200px]">{contact.email || '-'}</div>
                      </td>
                      <td className={cn(
                        "px-4 py-3 whitespace-nowrap text-sm hidden lg:table-cell",
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}>
                        {contact.phone || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusColors[contact.status]}`}>
                          {contact.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactList

