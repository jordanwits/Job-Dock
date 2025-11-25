import { useEffect, useMemo } from 'react'
import { useContactStore } from '../store/contactStore'
import ContactCard from './ContactCard'
import { Button, Input } from '@/components/ui'

const ContactList = () => {
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

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Filter and search contacts
  const filteredContacts = useMemo(() => {
    let filtered = contacts

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((contact) => contact.status === statusFilter)
    }

    // Search filter
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

    return filtered
  }, [contacts, statusFilter, searchQuery])

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
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'active' | 'inactive' | 'lead'
              )
            }
            className="h-10 rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="lead">Lead</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-primary-light/70">
        {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
      </div>

      {/* Contact List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70">Loading contacts...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70 mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'No contacts match your filters'
              : 'No contacts yet'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button variant="primary">Add Your First Contact</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ContactList

