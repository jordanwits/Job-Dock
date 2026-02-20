import Button from '@/components/ui/Button'
import { appEnv, dataModeController } from '@/lib/env'

const DataSourceIndicator = () => {
  const isLive = appEnv.isLive
  const switchLabel = isLive ? 'Use mock data' : 'Use live AWS data'
  const handleSwitch = () => dataModeController.set(isLive ? 'mock' : 'live')
  const showApiWarning = isLive && (!appEnv.apiUrl || appEnv.apiUrl.includes('localhost'))

  return (
    <div className="mb-6 rounded-2xl border border-primary-blue/30 bg-primary-blue/10 p-4 text-primary-light shadow-lg shadow-primary-dark/30">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary-light/60">Data Source</p>
          <p className="text-lg font-semibold text-primary-light">
            {isLive ? 'Live · AWS' : 'Mock · Local'}
          </p>
          <p className="text-sm text-primary-light/70">
            {isLive
              ? `API: ${appEnv.apiUrl || 'not configured'} · Region: ${appEnv.awsRegion}`
              : 'Serving in-browser mock data. No AWS calls yet.'}
          </p>
          {showApiWarning && (
            <p className="mt-2 text-sm text-amber-300">
              Live mode is enabled but the API URL still points to localhost. Run{' '}
              <code className="font-mono text-primary-light">npm run sync:aws:env</code> or update
              your <code className="font-mono text-primary-light">.env</code> file.
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" onClick={handleSwitch}>
            {switchLabel}
          </Button>
          <button
            type="button"
            onClick={() => dataModeController.clear()}
            className="text-xs font-semibold uppercase tracking-wide text-primary-light/70 hover:text-primary-gold"
          >
            Reset Preference
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataSourceIndicator
