/**
 * Validates contact has required channels for sending quote/invoice.
 * Mirrors backend logic in dataService (shouldSendEmail, shouldSendSms).
 */

type NotificationPreference = 'email' | 'sms' | 'both'

function shouldSendEmail(preference?: NotificationPreference | string | null): boolean {
  return preference === 'email' || preference === 'both' || !preference
}

function shouldSendSms(preference?: NotificationPreference | string | null): boolean {
  return preference === 'sms' || preference === 'both' || !preference
}

export interface SendValidationInput {
  contactEmail?: string | null
  contactPhone?: string | null
  contactNotificationPreference?: NotificationPreference | string | null
}

/**
 * Returns a user-friendly error message if the contact cannot receive the quote/invoice,
 * or null if valid. Use before calling send API to show UI error instead of 400.
 */
export function getSendValidationError(input: SendValidationInput): string | null {
  const pref = input.contactNotificationPreference ?? 'both'
  const wantsEmail = shouldSendEmail(pref)
  const wantsSms = shouldSendSms(pref)

  if (wantsEmail && !input.contactEmail?.trim()) {
    return 'Contact prefers email but has no email address. Update the contact or their notification preference.'
  }
  if (wantsSms && !input.contactPhone?.trim()) {
    return 'Contact prefers text but has no phone number. Update the contact or their notification preference.'
  }
  if (!wantsEmail && !wantsSms) {
    return 'Contact has no valid notification preference. Update the contact settings.'
  }
  return null
}
