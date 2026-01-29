import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, PhoneInput, Card } from '@/components/ui'
import { settingsApi, TenantSettings } from '@/lib/api/settings'
import { onboardingApi } from '@/lib/api/onboarding'
import { useAuthStore } from '@/features/auth'

type Step = 'welcome' | 'company-info' | 'logo' | 'tour-start'

export const OnboardingPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState<Step>('welcome')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [companyDisplayName, setCompanyDisplayName] = useState('')
  const [companySupportEmail, setCompanySupportEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Load existing settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await settingsApi.getSettings()
        setSettings(data)
        setCompanyDisplayName(data.companyDisplayName || '')
        setCompanySupportEmail(data.companySupportEmail || '')
        setCompanyPhone(data.companyPhone || '')
        if (data.logoSignedUrl) {
          setLogoPreview(data.logoSignedUrl)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
  }, [])

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveCompanyInfo = async () => {
    try {
      setLoading(true)

      // Only update if at least one field is filled
      const hasData = companyDisplayName || companySupportEmail || companyPhone

      if (hasData) {
        await settingsApi.updateSettings({
          companyDisplayName: companyDisplayName || undefined,
          companySupportEmail: companySupportEmail || undefined,
          companyPhone: companyPhone || undefined,
        })
      }

      setStep('logo')
    } catch (error) {
      console.error('Failed to save company info:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLogo = async () => {
    try {
      setLoading(true)

      if (logoFile) {
        setUploadingLogo(true)
        await settingsApi.uploadLogo(logoFile)
        setUploadingLogo(false)
      }

      setStep('tour-start')
    } catch (error) {
      console.error('Failed to upload logo:', error)
      setUploadingLogo(false)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTour = async () => {
    try {
      setLoading(true)

      console.log('Starting tour - marking onboarding as complete')
      // Mark onboarding as complete
      const result = await onboardingApi.complete()
      console.log('Onboarding marked complete:', result)

      // Update user in auth store BEFORE navigating
      if (user) {
        useAuthStore.setState({
          user: {
            ...user,
            onboardingCompletedAt: result.onboardingCompletedAt,
          },
        })
        console.log('User state updated with onboarding completion')
      }

      // Small delay to ensure state update propagates
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log('Navigating to /app?tour=start')
      // Navigate to dashboard and trigger tour
      navigate('/app?tour=start')
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error)
      console.error('Error details:', error.response?.data || error.message)
      alert(`Failed to start tour: ${error.response?.data?.error?.message || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipAll = async () => {
    try {
      setLoading(true)

      // Mark onboarding as complete
      const result = await onboardingApi.complete()

      // Update user in auth store BEFORE navigating
      if (user) {
        useAuthStore.setState({
          user: {
            ...user,
            onboardingCompletedAt: result.onboardingCompletedAt,
          },
        })
      }

      // Small delay to ensure state update propagates
      await new Promise(resolve => setTimeout(resolve, 100))

      // Navigate to dashboard without tour
      navigate('/app')
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {step === 'welcome' && (
          <Card className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-primary-gold">Welcome to JobDock!</h1>
              <p className="text-lg text-primary-light/80">
                Let's get you started with a quick tour and setup to make JobDock your own.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-start space-x-3 text-primary-light">
                <svg
                  className="w-6 h-6 text-primary-gold flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold">Company Information</h3>
                  <p className="text-sm text-primary-light/70">
                    Add your company details to personalize invoices and quotes
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-primary-light">
                <svg
                  className="w-6 h-6 text-primary-gold flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold">Upload Your Logo</h3>
                  <p className="text-sm text-primary-light/70">
                    Brand your documents with your company logo
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-primary-light">
                <svg
                  className="w-6 h-6 text-primary-gold flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold">Quick Tour</h3>
                  <p className="text-sm text-primary-light/70">Brief walkthrough of each page</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={handleSkipAll}
                disabled={loading}
                className="flex-1"
              >
                Skip All
              </Button>
              <Button onClick={() => setStep('company-info')} disabled={loading} className="flex-1">
                Get Started
              </Button>
            </div>
          </Card>
        )}

        {step === 'company-info' && (
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary-gold">Company Information</h2>
              <p className="text-primary-light/70">
                This information will appear on your invoices, quotes, and emails. All fields are
                optional.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Company Name"
                value={companyDisplayName}
                onChange={e => setCompanyDisplayName(e.target.value)}
                placeholder="Your Company Name"
              />

              <Input
                label="Support Email"
                type="email"
                value={companySupportEmail}
                onChange={e => setCompanySupportEmail(e.target.value)}
                placeholder="support@yourcompany.com"
                helperText="Displayed in email footers and on invoices/quotes"
              />

              <PhoneInput
                label="Phone Number"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                placeholder="123-456-7890"
                helperText="Displayed on invoices and quotes for customer contact"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('welcome')} disabled={loading}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => setStep('logo')} disabled={loading}>
                Skip
              </Button>
              <Button
                onClick={handleSaveCompanyInfo}
                disabled={loading}
                isLoading={loading}
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </Card>
        )}

        {step === 'logo' && (
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary-gold">Company Logo</h2>
              <p className="text-primary-light/70">
                Upload your company logo. It will appear on invoices, quotes, and emails.
              </p>
            </div>

            <div className="space-y-4">
              {logoPreview && (
                <div className="p-6 bg-primary-dark-secondary rounded-lg border border-primary-blue">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleLogoSelect}
                className="hidden"
              />

              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="w-full"
              >
                {logoFile ? 'Change Logo' : settings?.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </Button>

              <p className="text-sm text-primary-light/60 text-center">
                Supported formats: PNG, JPEG, SVG. Max size: 5MB.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setStep('company-info')}
                disabled={loading || uploadingLogo}
              >
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep('tour-start')}
                disabled={loading || uploadingLogo}
              >
                Skip
              </Button>
              <Button
                onClick={handleSaveLogo}
                disabled={loading || uploadingLogo}
                isLoading={loading || uploadingLogo}
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </Card>
        )}

        {step === 'tour-start' && (
          <Card className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary-gold/20 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-8 h-8 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-primary-gold">You're All Set!</h2>
              <p className="text-lg text-primary-light/80">
                Would you like a quick tour of the application?
              </p>
              <p className="text-sm text-primary-light/60">
                We'll show you each page and what it's used for. Takes less than a minute.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleSkipAll}
                disabled={loading}
                className="flex-1"
              >
                Skip Tour
              </Button>
              <Button
                onClick={handleStartTour}
                disabled={loading}
                isLoading={loading}
                className="flex-1"
              >
                Start Tour
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
