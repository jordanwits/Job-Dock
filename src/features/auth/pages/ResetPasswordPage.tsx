import ResetPasswordForm from '../components/ResetPasswordForm'

const ResetPasswordPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center space-y-1">
          <h1 className="text-4xl font-bold text-primary-gold">JobDock</h1>
          <p className="text-primary-light/60">Contractor Management Platform</p>
        </div>

        <div className="bg-primary-dark-secondary rounded-xl border border-white/10 p-8 shadow-lg shadow-black/30">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage

