import axios from 'axios'

// Backend errors arrive as `{ error: string }` (or `{ error, issues }` for zod
// 400s). Pull that message out; fall back to something readable when there was
// no response at all (server down, CORS, timeout).
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
    if (!err.response) return 'Network error — is the server running?'
    return `Request failed (${err.response.status})`
  }
  return 'Something went wrong'
}
