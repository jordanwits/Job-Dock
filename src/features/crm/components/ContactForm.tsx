import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { contactSchema, type ContactFormData } from '../schemas/contactSchemas'
import { Contact } from '../types/contact'
import { Input, Button, Select, PhoneInput } from '@/components/ui'

interface ContactFormProps {
  contact?: Contact
  onSubmit: (data: ContactFormData, scheduleJob?: boolean) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const ContactForm = ({ contact, onSubmit, onCancel, isLoading }: ContactFormProps) => {
  const [scheduleJobAfterCreate, setScheduleJobAfterCreate] = useState(false)
  
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
        status: contact.status || 'lead',
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
    await onSubmit(cleanedData, scheduleJobAfterCreate)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
        <PhoneInput
          label="Phone"
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

      {/* Schedule job option - only show when creating new contact */}
      {!contact && (
        <div className="border-t border-primary-blue pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleJobAfterCreate}
              onChange={(e) => setScheduleJobAfterCreate(e.target.checked)}
              className="w-4 h-4 rounded border-primary-blue bg-primary-dark-secondary text-primary-gold focus:ring-2 focus:ring-primary-gold focus:ring-offset-0"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-primary-light">
                Schedule a job for this contact
              </span>
              <p className="text-xs text-primary-light/50 mt-0.5">
                After creating this contact, open the job scheduling form
              </p>
            </div>
          </label>
        </div>
      )}

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

