import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

// UX guard, not security: the API already 401s without a valid token.
// This just keeps logged-out users from ever rendering a page that would fail,
// and remembers where they were headed so login can send them back.
// T6.2 replaces this localStorage read with the Zustand auth store.
function hasToken(): boolean {
  return localStorage.getItem('token') !== null
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!hasToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
