import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function LandingPage() {
  const token = useAuthStore((s) => s.token)
  // Returning users skip the pitch. Rendering <Navigate> (not a useEffect)
  // means the landing page never paints, so there is no flash before the jump.
  if (token) return <Navigate to="/projects" replace />

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold text-slate-800">Break any project into doable steps</h1>
        <p className="text-lg text-slate-600">
          Describe a goal. AI splits it into weighted subtasks, and every subtask can be broken down
          again. Tick things off and watch completion roll up the tree.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
          >
            Get started
          </Link>
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
