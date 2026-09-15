import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { signup } from '../api/auth'
import { useAuthStore } from '../store/auth'

export default function SignupPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.login)

  return (
    <AuthForm
      title="Create account"
      submitLabel="Sign up"
      onSubmit={async (email, password) => {
        const { token, user } = await signup(email, password)
        setAuth(token, user)
        navigate('/projects', { replace: true })
      }}
      footer={
        <>
          Already have an account? <Link to="/login" className="text-indigo-600 hover:underline">Log in</Link>
        </>
      }
    />
  )
}
