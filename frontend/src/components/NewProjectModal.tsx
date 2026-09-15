import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { createProject } from '../api/projects'
import { getErrorMessage } from '../api/errors'

interface Props {
  onClose: () => void
}

export default function NewProjectModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Give the project a title.')
      return
    }
    setError(null)
    setCreating(true)
    try {
      const { project } = await createProject(title.trim(), description.trim() || undefined)
      navigate(`/projects/${project.id}`)
    } catch (err) {
      // Keep the modal open so nothing the user typed is lost.
      setError(getErrorMessage(err))
      setCreating(false)
    }
  }

  // While Gemini runs (~10-15s) the modal blocks: no close, no backdrop
  // dismiss, no second submit. Cheaper than handling a half-created project.
  if (creating) {
    return (
      <Modal title="Breaking down your project…" onClose={() => {}}>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div
            role="status"
            aria-label="Working"
            className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
          />
          <p className="text-slate-600">
            AI is splitting <span className="font-medium text-slate-800">{title.trim()}</span> into
            subtasks. This usually takes 10–15 seconds.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-600">Title</span>
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="Learn Rust"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Description (optional)</span>
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="Any detail that helps the breakdown — scope, deadline, constraints."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}
