import { useEffect, useMemo, useState } from 'react'
import { useContactStore } from '../store/contactStore'
import ContactCard from './ContactCard'
import { Button, Input, Select } from '@/components/ui'

interface ContactListProps {
  onCreateClick?: () => void
}

type ViewMode = 'status' | 'alphabetical' | 'dateEntered'

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
    clearError,
  } = useContactStore()

  const [viewMode, setViewMode] = useState<ViewMode>('dateEntered')

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

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
          contact.phone?.includes(query) ||
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
        const lastNameCompare = a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase())
        if (lastNameCompare !== 0) return lastNameCompare
        return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase())
      })
    } else if (viewMode === 'dateEntered') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return sorted
  }, [baseFilteredContacts, viewMode])

  // Grouped contacts for status board view
  const { leadContacts, activeContacts, inactiveContacts } = useMemo(() => {
    if (viewMode !== 'status') {
      return { leadContacts: [], activeContacts: [], inactiveContacts: [] }
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
          contact.phone?.includes(query) ||
          contact.company?.toLowerCase().includes(query)
      )
    }

    return {
      leadContacts: searchFiltered.filter((c) => c.status === 'lead'),
      activeContacts: searchFiltered.filter((c) => c.status === 'active'),
      inactiveContacts: searchFiltered.filter((c) => c.status === 'inactive'),
    }
  }, [contacts, searchQuery, viewMode])

  // Get the appropriate list for display based on view mode
  const displayContacts = viewMode === 'status' 
    ? [...leadContacts, ...activeContacts, ...inactiveContacts]
    : sortedContacts

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
              { value: 'status', label: 'By status (Lead / Active / Inactive)' },
            ]}
            className="w-full sm:w-auto min-w-[200px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'active' | 'inactive' | 'lead'
              )
            }
            disabled={viewMode === 'status'}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'lead', label: 'Lead' },
            ]}
            helperText={viewMode === 'status' ? 'Status filter is not available in status board view' : undefined}
            className="w-full sm:w-auto min-w-[140px]"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-primary-light/70">
        {displayContacts.length} contact{displayContacts.length !== 1 ? 's' : ''} found
      </div>

      {/* Contact List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70">Loading contacts...</p>
        </div>
      ) : displayContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70 mb-4">
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
            <div className="flex items-center justify-between pb-2 border-b border-primary-gold/30">
              <h3 className="text-lg font-semibold text-primary-gold">Lead</h3>
              <span className="text-sm text-primary-light/70">{leadContacts.length}</span>
            </div>
            {leadContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-primary-light/50">No leads yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leadContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </div>

          {/* Active Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-green-500/30">
              <h3 className="text-lg font-semibold text-green-400">Active</h3>
              <span className="text-sm text-primary-light/70">{activeContacts.length}</span>
            </div>
            {activeContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-primary-light/50">No active contacts</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </div>

          {/* Inactive Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-500/30">
              <h3 className="text-lg font-semibold text-gray-400">Inactive</h3>
              <span className="text-sm text-primary-light/70">{inactiveContacts.length}</span>
            </div>
            {inactiveContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-primary-light/50">No inactive contacts</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inactiveContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Alphabetical and Date Entered Views - Grid Layout
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ContactList

