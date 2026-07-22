import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function LandingPage() {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">TaskTree</h1>
        <p className="mt-4 max-w-md text-slate-600">
          Break any project into a living tree of subtasks — AI-assisted, weighted, and tracked
          to completion.
        </p>
        <Link
          to="/signup"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Get Started
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
