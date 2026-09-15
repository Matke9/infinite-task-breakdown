import { api } from './client'
import type { User } from '../store/auth'

interface AuthResponse {
  token: string
  user: User
}

export const signup = (email: string, password: string) =>
  api.post<AuthResponse>('/api/auth/signup', { email, password }).then((r) => r.data)

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/api/auth/login', { email, password }).then((r) => r.data)
