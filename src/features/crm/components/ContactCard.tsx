import { Contact } from '../types/contact'
import { useContactStore } from '../store/contactStore'
import { cn } from '@/lib/utils'
import {
  Avatar,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  SelectCircle,
  StatusBadge,
  TagChip,
} from './crmUi'
import { CONTACT_STATUS } from './contactStatus'

interface ContactCardProps {
  contact: Contact
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const ContactCard = ({ contact, isSelected, onToggleSelect }: ContactCardProps) => {
  const { setSelectedContact } = useContactStore()
  const fullName = `${contact.firstName} ${contact.lastName}`
  const status = CONTACT_STATUS[contact.status] ?? CONTACT_STATUS.contact

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelectedContact(contact)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setSelectedContact(contact)
        }
      }}
      className={cn(
        'group relative cursor-pointer rounded-xl bg-surface p-5 shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      {/* Top row: identity + status / selection */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar firstName={contact.firstName} lastName={contact.lastName} />
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink">{fullName}</h3>
            {contact.jobTitle && (
              <p className="truncate text-[13px] text-ink-subtle">{contact.jobTitle}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {onToggleSelect && (
            <SelectCircle
              selected={!!isSelected}
              onClick={e => {
                e.stopPropagation()
                onToggleSelect(contact.id, e)
              }}
            />
          )}
        </div>
      </div>

      {/* Company */}
      {contact.company && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <BuildingIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
          <span className="truncate">{contact.company}</span>
        </p>
      )}

      {/* Contact info */}
      {(contact.email || contact.phone) && (
        <div className="mt-2.5 space-y-1.5 text-sm text-ink-muted">
          {contact.email && (
            <div className="flex items-center gap-2">
              <MailIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
              <span className="font-mono tabular-nums">{contact.phone}</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {contact.tags.slice(0, 3).map((tag, index) => (
            <TagChip key={index}>{tag}</TagChip>
          ))}
          {contact.tags.length > 3 && (
            <span className="self-center text-xs text-ink-subtle">+{contact.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default ContactCard
