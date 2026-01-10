import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { contactSchema, type ContactFormData } from '../schemas/contactSchemas'
import { Contact } from '../types/contact'
import { Input, Button, Select } from '@/components/ui'

interface ContactFormProps {
  contact?: Contact
  onSubmit: (data: ContactFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const ContactForm = ({ contact, onSubmit, onCancel, isLoading }: ContactFormProps) => {
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportMessage, setShowImportMessage] = useState(false)
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      company: contact?.company || '',
      jobTitle: contact?.jobTitle || '',
      address: contact?.address || '',
      city: contact?.city || '',
      state: contact?.state || '',
      zipCode: contact?.zipCode || '',
      country: contact?.country || '',
      tags: contact?.tags || [],
      notes: contact?.notes || '',
      status: contact?.status || 'lead',
    },
  })

  const statusValue = watch('status')

  // Check if Contact Picker API is available
  const isContactPickerSupported = 'contacts' in navigator && 'ContactsManager' in window
  
  // Detect iOS for alternative import method
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

  // Parse vCard data
  const parseVCard = (vcardText: string) => {
    const lines = vcardText.split(/\r?\n/)
    const contact: any = {}
    
    for (const line of lines) {
      if (line.startsWith('FN:')) {
        const fullName = line.substring(3).trim()
        const nameParts = fullName.split(' ')
        contact.firstName = nameParts[0] || ''
        contact.lastName = nameParts.slice(1).join(' ') || ''
      } else if (line.startsWith('N:')) {
        const parts = line.substring(2).split(';')
        contact.lastName = parts[0] || contact.lastName || ''
        contact.firstName = parts[1] || contact.firstName || ''
      } else if (line.startsWith('EMAIL')) {
        const email = line.split(':')[1]?.trim()
        if (email && !contact.email) contact.email = email
      } else if (line.startsWith('TEL')) {
        const phone = line.split(':')[1]?.trim()
        if (phone && !contact.phone) contact.phone = phone
      } else if (line.startsWith('ORG:')) {
        contact.company = line.substring(4).trim()
      } else if (line.startsWith('TITLE:')) {
        contact.jobTitle = line.substring(6).trim()
      } else if (line.startsWith('ADR')) {
        const parts = line.split(':')[1]?.split(';') || []
        // vCard ADR format: PO Box;Extended;Street;City;State;Postal;Country
        if (parts[2]) contact.address = parts[2].trim()
        if (parts[3]) contact.city = parts[3].trim()
        if (parts[4]) contact.state = parts[4].trim()
        if (parts[5]) contact.zipCode = parts[5].trim()
        if (parts[6]) contact.country = parts[6].trim()
      }
    }
    
    return contact
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportError(null)
    setShowImportMessage(false)
    setIsImporting(true)

    try {
      const text = await file.text()
      const parsedContact = parseVCard(text)

      if (!parsedContact.firstName && !parsedContact.lastName) {
        throw new Error('Could not find contact name in file')
      }

      reset({
        firstName: parsedContact.firstName || '',
        lastName: parsedContact.lastName || '',
        email: parsedContact.email || '',
        phone: parsedContact.phone || '',
        company: parsedContact.company || '',
        jobTitle: parsedContact.jobTitle || '',
        address: parsedContact.address || '',
        city: parsedContact.city || '',
        state: parsedContact.state || '',
        zipCode: parsedContact.zipCode || '',
        country: parsedContact.country || '',
        tags: [],
        notes: '',
        status: 'lead',
      })

      setShowImportMessage(true)
      setTimeout(() => setShowImportMessage(false), 3000)
    } catch (error: any) {
      console.error('vCard import error:', error)
      setImportError('Failed to read contact file. Please use the "Share Contact" option from your Contacts app.')
      setTimeout(() => setImportError(null), 5000)
    } finally {
      setIsImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleImportFromContacts = async () => {
    setImportError(null)
    setShowImportMessage(false)
    
    if (!isContactPickerSupported) {
      setImportError('Contact import is not supported in this browser. Please enter the information manually.')
      setShowImportMessage(true)
      setTimeout(() => setShowImportMessage(false), 5000)
      return
    }

    try {
      setIsImporting(true)
      
      // Request contact selection with desired properties
      const contacts = await (navigator as any).contacts.select(
        ['name', 'email', 'tel', 'address'],
        { multiple: false }
      )

      if (contacts && contacts.length > 0) {
        const selectedContact = contacts[0]
        
        // Extract name parts
        let firstName = ''
        let lastName = ''
        if (selectedContact.name && selectedContact.name.length > 0) {
          const nameParts = selectedContact.name[0].split(' ')
          firstName = nameParts[0] || ''
          lastName = nameParts.slice(1).join(' ') || ''
        }

        // Extract email
        const email = selectedContact.email && selectedContact.email.length > 0 
          ? selectedContact.email[0] 
          : ''

        // Extract phone
        const phone = selectedContact.tel && selectedContact.tel.length > 0 
          ? selectedContact.tel[0] 
          : ''

        // Extract address parts if available
        let address = ''
        let city = ''
        let state = ''
        let zipCode = ''
        let country = ''
        
        if (selectedContact.address && selectedContact.address.length > 0) {
          const addr = selectedContact.address[0]
          address = addr.addressLine ? addr.addressLine.join(', ') : ''
          city = addr.city || ''
          state = addr.region || ''
          zipCode = addr.postalCode || ''
          country = addr.country || ''
        }

        // Update form with imported values
        reset({
          firstName,
          lastName,
          email,
          phone,
          company: '',
          jobTitle: '',
          address,
          city,
          state,
          zipCode,
          country,
          tags: [],
          notes: '',
          status: 'lead',
        })

        setShowImportMessage(true)
        setTimeout(() => setShowImportMessage(false), 3000)
      }
    } catch (error: any) {
      console.error('Contact import error:', error)
      if (error.name === 'AbortError') {
        // User cancelled - no error message needed
      } else {
        setImportError('Failed to import contact. Please try again or enter manually.')
        setTimeout(() => setImportError(null), 5000)
      }
    } finally {
      setIsImporting(false)
    }
  }

  useEffect(() => {
    if (contact) {
      reset({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        jobTitle: contact.jobTitle || '',
        address: contact.address || '',
        city: contact.city || '',
        state: contact.state || '',
        zipCode: contact.zipCode || '',
        country: contact.country || '',
        tags: contact.tags || [],
        notes: contact.notes || '',
        status: contact.status || 'active',
      })
    }
  }, [contact, reset])

  const handleFormSubmit = async (data: ContactFormData) => {
    // Clean up empty strings
    const cleanedData = {
      ...data,
      email: data.email || undefined,
      phone: data.phone || undefined,
      company: data.company || undefined,
      jobTitle: data.jobTitle || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      zipCode: data.zipCode || undefined,
      country: data.country || undefined,
      notes: data.notes || undefined,
    }
    await onSubmit(cleanedData)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Import from contacts section */}
      {!contact && (
        <div className="pb-4 border-b border-primary-blue">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-primary-light mb-1">Quick Import</h3>
              <p className="text-xs text-primary-light/60">
                {isContactPickerSupported 
                  ? 'Import contact details from your phone contacts to save time'
                  : isIOS
                  ? 'Import a contact from your Contacts app (tap Share Contact to get the file)'
                  : 'Import a contact by uploading a vCard file (.vcf)'}
              </p>
            </div>
            {isContactPickerSupported ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleImportFromContacts}
                disabled={isImporting}
                className="w-full sm:w-auto border border-primary-blue hover:bg-primary-blue/10"
              >
                {isImporting ? 'Importing...' : 'Import from Phone Contacts'}
              </Button>
            ) : (
              <div className="w-full sm:w-auto">
                <input
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard"
                  onChange={handleFileImport}
                  disabled={isImporting}
                  className="hidden"
                  id="vcard-upload"
                />
                <label 
                  htmlFor="vcard-upload"
                  className={`
                    inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium
                    border border-primary-blue hover:bg-primary-blue/10 
                    text-primary-light transition-colors cursor-pointer
                    w-full sm:w-auto
                    ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isImporting ? 'Importing...' : 'Import from Contacts'}
                </label>
              </div>
            )}
          </div>
          
          {/* Success message */}
          {showImportMessage && !importError && (
            <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-xs text-green-400">
                ✓ Contact imported! Review the details below and make any changes before saving.
              </p>
              {isIOS && (
                <p className="text-xs text-green-400/70 mt-1">
                  Tip: In Contacts app → Select contact → Scroll down → Tap "Share Contact"
                </p>
              )}
            </div>
          )}
          
          {/* Error message */}
          {importError && (
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-xs text-orange-400">
                {importError}
              </p>
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name *"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label="Last Name *"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Phone"
          type="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Company"
          error={errors.company?.message}
          {...register('company')}
        />
        <Input
          label="Job Title"
          error={errors.jobTitle?.message}
          {...register('jobTitle')}
        />
      </div>

      <Input
        label="Address"
        error={errors.address?.message}
        {...register('address')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="City"
          error={errors.city?.message}
          {...register('city')}
        />
        <Input
          label="State"
          error={errors.state?.message}
          {...register('state')}
        />
        <Input
          label="Zip Code"
          error={errors.zipCode?.message}
          {...register('zipCode')}
        />
      </div>

      <Input
        label="Country"
        error={errors.country?.message}
        {...register('country')}
      />

      <Select
        label="Status"
        {...register('status')}
        value={statusValue}
        error={errors.status?.message}
        options={[
          { value: 'lead', label: 'Lead' },
          { value: 'prospect', label: 'Prospect' },
          { value: 'customer', label: 'Customer' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'contact', label: 'Contact' },
        ]}
      />

      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Notes
        </label>
        <textarea
          className="flex min-h-[100px] w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Add notes about this contact..."
          {...register('notes')}
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-500">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : contact ? 'Update Contact' : 'Create Contact'}
        </Button>
      </div>
    </form>
  )
}

export default ContactForm

