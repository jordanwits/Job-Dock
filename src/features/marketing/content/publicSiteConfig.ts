/**
 * Public site configuration
 * Update this file with your exact business contact information
 */

export const publicSiteConfig = {
  // Company information
  companyName: 'JobDock',
  companyLegalName: 'JobDock LLC',
  
  // Contact information - UPDATE THESE WITH YOUR EXACT DETAILS
  supportEmail: 'jordan@westwavecreative.com',
  fromEmail: 'noreply@thejobdock.com',
  
  // Physical mailing address - REQUIRED FOR CAN-SPAM COMPLIANCE
  mailingAddress: {
    street: '2211 Everest Dr',
    city: 'Redding',
    state: 'CA',
    zip: '96001',
    country: 'United States',
  },
  
  // Website URLs
  websiteUrl: 'https://www.thejobdock.com',
  appUrl: 'https://www.thejobdock.com/app',
  
  // Phone number
  phoneNumber: '530-338-7829',
  
  // Copyright
  copyrightYear: new Date().getFullYear(),
  copyrightHolder: 'JobDock LLC',
  
  // Social media (optional)
  social: {
    twitter: '',
    linkedin: '',
    facebook: '',
  },
}

// Format the full mailing address as a single string
export const getFormattedAddress = (): string => {
  const { street, city, state, zip, country } = publicSiteConfig.mailingAddress
  return `${street}, ${city}, ${state} ${zip}, ${country}`
}
