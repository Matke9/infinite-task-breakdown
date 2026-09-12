import { useEffect, useState } from 'react'
import { listProjects, deleteProject } from '../api/projects'
import type { Project } from '../api/projects'
import { getErrorMessage } from '../api/errors'
import { useAuthStore } from '../store/auth'
import ProjectCard from '../components/ProjectCard'
import EditProjectModal from '../components/EditProjectModal'
import ConfirmModal from '../components/ConfirmModal'

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [projects, setProjects] = useState<Project[] | null>(null) // null = loading
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false) // NewProjectModal arrives in T6.6

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError(getErrorMessage(err)))
  }, [])

  function handleSaved(updated: Project) {
    // Server bumps updated_at; keep the list in the same order the API uses.
    setProjects((ps) =>
      (ps ?? [])
        .map((p) => (p.id === updated.id ? updated : p))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    )
    setEditing(null)
  }

  async function handleDelete(p: Project) {
    await deleteProject(p.id)
    setProjects((ps) => (ps ?? []).filter((x) => x.id !== p.id))
    setDeleting(null)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-800">My projects</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">{user?.email}</span>
          <button type="button" onClick={logout} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}
        {!error && projects === null && <p className="text-slate-500">Loading…</p>}
        {projects?.length === 0 && (
          <p className="mt-24 text-center text-slate-500">Click + to create your first project</p>
        )}
        {projects && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onEdit={() => setEditing(p)} onDelete={() => setDeleting(p)} />
            ))}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="New project"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-3xl text-white shadow-lg hover:bg-indigo-700"
      >
        +
      </button>

      {editing && <EditProjectModal project={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {deleting && (
        <ConfirmModal
          title="Delete project?"
          message={`"${deleting.title}" and all its tasks will be permanently deleted.`}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {creating && (
        <ConfirmModal
          title="Coming in T6.6"
          message="The new-project modal is the next task."
          confirmLabel="OK"
          onConfirm={async () => setCreating(false)}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
