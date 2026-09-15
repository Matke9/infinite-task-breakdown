import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { login } from '../api/auth'
import { useAuthStore } from '../store/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.login)
  // ProtectedRoute stashes the page the user was trying to reach.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/projects'

  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={async (email, password) => {
        const { token, user } = await login(email, password)
        setAuth(token, user)
        navigate(from, { replace: true })
      }}
      footer={
        <>
          No account? <Link to="/signup" className="text-indigo-600 hover:underline">Sign up</Link>
        </>
      }
    />
  )
}
