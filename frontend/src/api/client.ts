import axios from 'axios'
import { API_URL } from '../config'
import { useAuthStore } from '../store/auth'

export const api = axios.create({ baseURL: API_URL })

// Attach the bearer token to every request when logged in.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// A 401 on an authenticated request means the token is dead (expired, secret
// rotated, user gone). Clear the store; ProtectedRoute re-renders and redirects
// to /login. A 401 from the login form itself (no token attached) is a normal
// "wrong password" and is left for the form to display.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.headers?.Authorization) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)
