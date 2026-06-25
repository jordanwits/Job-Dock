import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { contactSchema, type ContactFormData } from '../schemas/contactSchemas'
import { Contact } from '../types/contact'
import {
  Alert,
  AppButton,
  AlertIcon,
  CheckboxField,
  PhoneField,
  SelectField,
  TextAreaField,
  TextField,
} from './crmUi'

interface ContactFormProps {
  contact?: Contact
  onSubmit: (data: ContactFormData, scheduleJob?: boolean) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
}

const ContactForm = ({ contact, onSubmit, onCancel, isLoading, error }: ContactFormProps) => {
  const [scheduleJobAfterCreate, setScheduleJobAfterCreate] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) {
      const id = requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return () => cancelAnimationFrame(id)
    }
  }, [error])

  const {
    register,
    control,
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
      notificationPreference: contact?.notificationPreference || 'both',
    },
  })

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
        notificationPreference: contact.notificationPreference || 'both',
      })
    }
  }, [contact, reset])

  const handleFormSubmit = async (data: ContactFormData) => {
    // Use null for cleared optional fields so backend/Prisma can clear them (undefined gets stripped from JSON)
    const cleanedData = {
      ...data,
      email: (data.email?.trim() || null) as string | undefined,
      phone: (data.phone?.trim() || null) as string | undefined,
      company: (data.company?.trim() || null) as string | undefined,
      jobTitle: (data.jobTitle?.trim() || null) as string | undefined,
      address: (data.address?.trim() || null) as string | undefined,
      city: (data.city?.trim() || null) as string | undefined,
      state: (data.state?.trim() || null) as string | undefined,
      zipCode: (data.zipCode?.trim() || null) as string | undefined,
      country: (data.country?.trim() || null) as string | undefined,
      notes: data.notes ?? '',
      notificationPreference: data.notificationPreference || 'both',
    }
    await onSubmit(cleanedData, scheduleJobAfterCreate)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {error && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="First name *" error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Last name *" error={errors.lastName?.message} {...register('lastName')} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <PhoneField label="Phone" error={errors.phone?.message} {...field} value={field.value ?? ''} />
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Company" error={errors.company?.message} {...register('company')} />
        <TextField label="Job title" error={errors.jobTitle?.message} {...register('jobTitle')} />
      </div>

      <TextField label="Address" error={errors.address?.message} {...register('address')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField label="City" error={errors.city?.message} {...register('city')} />
        <TextField label="State" error={errors.state?.message} {...register('state')} />
        <TextField label="Zip code" error={errors.zipCode?.message} {...register('zipCode')} />
      </div>

      <TextField label="Country" error={errors.country?.message} {...register('country')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Status"
          error={errors.status?.message}
          value={watch('status')}
          options={[
            { value: 'lead', label: 'Lead' },
            { value: 'prospect', label: 'Prospect' },
            { value: 'customer', label: 'Customer' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'contact', label: 'Contact' },
          ]}
          {...register('status')}
        />
        <SelectField
          label="Notifications"
          error={errors.notificationPreference?.message}
          value={watch('notificationPreference')}
          options={[
            { value: 'both', label: 'Email & Text' },
            { value: 'email', label: 'Email only' },
            { value: 'sms', label: 'Text only' },
          ]}
          {...register('notificationPreference')}
        />
      </div>

      <TextAreaField
        label="Notes"
        placeholder="Add notes about this contact..."
        error={errors.notes?.message}
        {...register('notes')}
      />

      {/* Schedule job option - only show when creating new contact */}
      {!contact && (
        <div className="border-t border-line pt-4">
          <CheckboxField
            id="schedule-job-after-create"
            checked={scheduleJobAfterCreate}
            onChange={setScheduleJobAfterCreate}
            label="Schedule a job for this contact"
            description="After creating this contact, open the job scheduling form"
          />
        </div>
      )}

      {error && (
        <div ref={errorRef}>
          <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
            {error}
          </Alert>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <AppButton type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </AppButton>
        <AppButton type="submit" isLoading={isLoading} disabled={isLoading}>
          {isLoading ? 'Saving...' : contact ? 'Update contact' : 'Create contact'}
        </AppButton>
      </div>
    </form>
  )
}

export default ContactForm
