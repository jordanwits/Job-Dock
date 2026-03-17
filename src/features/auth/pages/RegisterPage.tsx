import { Navigate } from 'react-router-dom'

/** Redirects to signup flow - registration now requires plan selection. */
const RegisterPage = () => <Navigate to="/auth/signup" replace />

export default RegisterPage
