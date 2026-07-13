import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsApi, TenantSettings } from '@/lib/api/settings'
import { onboardingApi } from '@/lib/api/onboarding'
import { useAuthStore } from '@/features/auth'
import {
  AppButton,
  Alert,
  TextField,
  PhoneField,
  OnboardingCard,
  BuildingIcon,
  ImageIcon,
  CompassIcon,
  SparkleIcon,
  UploadIcon,
  ArrowLeftIcon,
} from '../components/onboardingUi'

type Step = 'welcome' | 'company-info' | 'logo' | 'tour-start'

const FORM_STEPS: Step[] = ['company-info', 'logo']

export const OnboardingPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState<Step>('welcome')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError(null)

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
      setError('We couldn’t save your company info. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLogo = async () => {
    try {
      setLoading(true)
      setError(null)

      if (logoFile) {
        setUploadingLogo(true)
        await settingsApi.uploadLogo(logoFile)
        setUploadingLogo(false)
      }

      setStep('tour-start')
    } catch (error) {
      console.error('Failed to upload logo:', error)
      setError('We couldn’t upload your logo. Please try a different file.')
      setUploadingLogo(false)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTour = async () => {
    try {
      setLoading(true)
      setError(null)

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

      // Navigate to dashboard and trigger tour
      navigate('/app?tour=start')
    } catch (error: unknown) {
      console.error('Failed to complete onboarding:', error)
      const err = error as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
      setError(err.response?.data?.error?.message || err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipAll = async () => {
    try {
      setLoading(true)
      setError(null)

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
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formStepIndex = FORM_STEPS.indexOf(step)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Brand mark */}
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-card ring-1 ring-line">
            <img src="/icon-192.png" alt="" className="h-8 w-auto" />
          </span>
        </div>

        {/* Step progress (form steps only) */}
        {formStepIndex !== -1 && (
          <div className="mx-auto mb-5 flex w-full max-w-[13rem] items-center justify-center gap-2">
            {FORM_STEPS.map((s, i) => (
              <span
                key={s}
                className={cnStep(i, formStepIndex)}
              />
            ))}
            <span className="ml-2 font-mono text-[13px] tabular-nums text-ink-subtle">
              {formStepIndex + 1}/{FORM_STEPS.length}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {step === 'welcome' && (
          <OnboardingCard className="space-y-7">
            <div className="space-y-2.5 text-center">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-accent-strong">
                Welcome
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                Let&rsquo;s set up CleanDock
              </h1>
              <p className="mx-auto max-w-md text-[15px] leading-relaxed text-ink-muted">
                A couple of quick steps to make CleanDock your own, then a short tour of the app.
              </p>
            </div>

            <div className="space-y-2.5">
              <FeatureRow
                icon={<BuildingIcon />}
                title="Company information"
                description="Personalize your invoices, quotes, and emails."
              />
              <FeatureRow
                icon={<ImageIcon />}
                title="Upload your logo"
                description="Brand every document you send to customers."
              />
              <FeatureRow
                icon={<CompassIcon />}
                title="Quick tour"
                description="A brief walkthrough of each page — under a minute."
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <AppButton
                variant="subtle"
                onClick={handleSkipAll}
                disabled={loading}
                className="sm:flex-1"
              >
                Skip for now
              </AppButton>
              <AppButton
                onClick={() => {
                  setError(null)
                  setStep('company-info')
                }}
                disabled={loading}
                className="sm:flex-1"
              >
                Get started
              </AppButton>
            </div>
          </OnboardingCard>
        )}

        {step === 'company-info' && (
          <OnboardingCard className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-ink">Company information</h2>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                This appears on your invoices, quotes, and emails. All fields are optional.
              </p>
            </div>

            <div className="space-y-4">
              <TextField
                label="Company name"
                value={companyDisplayName}
                onChange={e => setCompanyDisplayName(e.target.value)}
                placeholder="Your Company Name"
                leftIcon={<BuildingIcon />}
              />

              <TextField
                label="Support email"
                type="email"
                value={companySupportEmail}
                onChange={e => setCompanySupportEmail(e.target.value)}
                placeholder="support@yourcompany.com"
                helperText="Displayed in email footers and on invoices/quotes."
              />

              <PhoneField
                label="Phone number"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                placeholder="123-456-7890"
                helperText="Displayed on invoices and quotes for customer contact."
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <AppButton
                variant="ghost"
                onClick={() => setStep('welcome')}
                disabled={loading}
                className="sm:mr-auto"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </AppButton>
              <AppButton
                variant="subtle"
                onClick={() => {
                  setError(null)
                  setStep('logo')
                }}
                disabled={loading}
              >
                Skip
              </AppButton>
              <AppButton onClick={handleSaveCompanyInfo} disabled={loading} isLoading={loading}>
                Continue
              </AppButton>
            </div>
          </OnboardingCard>
        )}

        {step === 'logo' && (
          <OnboardingCard className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-ink">Company logo</h2>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                Upload your logo to brand invoices, quotes, and emails.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              onChange={handleLogoSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2 px-6 py-8 text-center transition-colors hover:border-accent hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="max-h-28 max-w-full object-contain"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <UploadIcon className="h-6 w-6" />
                </span>
              )}
              <span className="text-sm font-semibold text-ink">
                {logoFile || settings?.logoUrl ? 'Change logo' : 'Upload logo'}
              </span>
              <span className="text-[13px] text-ink-subtle">
                PNG, JPEG, or SVG &middot; max 5MB
              </span>
            </button>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <AppButton
                variant="ghost"
                onClick={() => setStep('company-info')}
                disabled={loading || uploadingLogo}
                className="sm:mr-auto"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </AppButton>
              <AppButton
                variant="subtle"
                onClick={() => {
                  setError(null)
                  setStep('tour-start')
                }}
                disabled={loading || uploadingLogo}
              >
                Skip
              </AppButton>
              <AppButton
                onClick={handleSaveLogo}
                disabled={loading || uploadingLogo}
                isLoading={loading || uploadingLogo}
              >
                Continue
              </AppButton>
            </div>
          </OnboardingCard>
        )}

        {step === 'tour-start' && (
          <OnboardingCard className="space-y-7">
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <SparkleIcon className="h-8 w-8" />
              </span>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-ink">You&rsquo;re all set!</h2>
                <p className="mx-auto max-w-md text-[15px] leading-relaxed text-ink-muted">
                  Want a quick tour? We&rsquo;ll show you each page and what it&rsquo;s for. Takes
                  less than a minute.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <AppButton
                variant="subtle"
                onClick={handleSkipAll}
                disabled={loading}
                className="sm:flex-1"
              >
                Skip tour
              </AppButton>
              <AppButton
                onClick={handleStartTour}
                disabled={loading}
                isLoading={loading}
                className="sm:flex-1"
              >
                Start tour
              </AppButton>
            </div>
          </OnboardingCard>
        )}
      </div>
    </div>
  )
}

/* ── Local presentational helpers ─────────────────────────────────────── */
function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
    </div>
  )
}

/** Progress-dot class for the form-step indicator. */
function cnStep(index: number, current: number) {
  const base = 'h-1.5 flex-1 rounded-full transition-colors'
  if (index < current) return `${base} bg-accent`
  if (index === current) return `${base} bg-accent-strong`
  return `${base} bg-line`
}
