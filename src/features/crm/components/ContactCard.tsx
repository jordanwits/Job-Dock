import { Contact } from '../types/contact'
import { useContactStore } from '../store/contactStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

interface ContactCardProps {
  contact: Contact
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const ContactCard = ({ contact, isSelected, onToggleSelect }: ContactCardProps) => {
  const { setSelectedContact } = useContactStore()
  const { theme } = useTheme()

  const statusColors = {
    customer: theme === 'dark'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
    inactive: theme === 'dark'
      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      : 'bg-gray-200 text-gray-700 border-gray-400',
    lead: theme === 'dark'
      ? 'bg-primary-gold/20 text-primary-gold border-primary-gold/30'
      : 'bg-yellow-100 text-yellow-700 border-yellow-300',
    prospect: theme === 'dark'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-blue-100 text-blue-700 border-blue-300',
    contact: theme === 'dark'
      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      : 'bg-cyan-100 text-cyan-700 border-cyan-300',
  }

  const fullName = `${contact.firstName} ${contact.lastName}`

  return (
    <Card
      className={cn(
        "cursor-pointer hover:border-primary-gold transition-colors relative",
        isSelected && "ring-2 ring-primary-gold"
      )}
      onClick={() => setSelectedContact(contact)}
    >
      <div className="space-y-3">
        {/* Selection Bullet Point */}
        {onToggleSelect && (
          <div 
            className="absolute top-3 left-3 z-10"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect(contact.id, e)
            }}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center",
                isSelected 
                  ? "bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50" 
                  : theme === 'dark'
                    ? "border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10"
                    : "border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-gray-100"
              )}
            >
              {isSelected && (
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                )} />
              )}
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className={cn("flex items-start justify-between", onToggleSelect && "pl-8")}>
          <div>
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>
              {fullName}
            </h3>
            {contact.jobTitle && (
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>{contact.jobTitle}</p>
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
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
          )}>{contact.company}</p>
        )}

        {/* Contact Info */}
        <div className={cn(
          "space-y-1 text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
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
                className={cn(
                  "px-2 py-0.5 text-xs rounded",
                  theme === 'dark'
                    ? 'bg-primary-blue/20 text-primary-blue'
                    : 'bg-blue-100 text-blue-700'
                )}
              >
                {tag}
              </span>
            ))}
            {contact.tags.length > 3 && (
              <span className={cn(
                "px-2 py-0.5 text-xs",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>
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

