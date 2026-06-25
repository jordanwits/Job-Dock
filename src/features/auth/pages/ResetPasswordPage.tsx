import ResetPasswordForm from '../components/ResetPasswordForm'
import { AuthShell, AuthCard } from '../components/authUi'

const ResetPasswordPage = () => {
  return (
    <AuthShell>
      <AuthCard>
        <ResetPasswordForm />
      </AuthCard>
    </AuthShell>
  )
}

export default ResetPasswordPage
