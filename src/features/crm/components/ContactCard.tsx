import { Contact } from '../types/contact'
import { useContactStore } from '../store/contactStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ContactCardProps {
  contact: Contact
}

const ContactCard = ({ contact }: ContactCardProps) => {
  const { setSelectedContact } = useContactStore()

  const statusColors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    lead: 'bg-primary-gold/20 text-primary-gold border-primary-gold/30',
    prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contact: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  }

  const fullName = `${contact.firstName} ${contact.lastName}`

  return (
    <Card
      className="cursor-pointer hover:border-primary-gold transition-colors"
      onClick={() => setSelectedContact(contact)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary-light">
              {fullName}
            </h3>
            {contact.jobTitle && (
              <p className="text-sm text-primary-light/70">{contact.jobTitle}</p>
            )}
          </div>
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border',
              statusColors[contact.status]
            )}
          >
            {contact.status}
          </span>
        </div>

        {/* Company */}
        {contact.company && (
          <p className="text-sm text-primary-light/80">{contact.company}</p>
        )}

        {/* Contact Info */}
        <div className="space-y-1 text-sm text-primary-light/70">
          {contact.email && (
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span>{contact.phone}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {contact.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs bg-primary-blue/20 text-primary-blue rounded"
              >
                {tag}
              </span>
            ))}
            {contact.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-primary-light/50">
                +{contact.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export default ContactCard

