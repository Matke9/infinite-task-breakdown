import { Link } from 'react-router-dom'
import type { Project } from '../api/projects'

interface Props {
  project: Project
  onEdit: () => void
  onDelete: () => void
}

export default function ProjectCard({ project, onEdit, onDelete }: Props) {
  const updated = new Date(project.updated_at).toLocaleDateString()

  return (
    <div className="group relative rounded-xl bg-white p-5 shadow hover:shadow-md transition-shadow">
      <Link to={`/projects/${project.id}`} className="block space-y-2">
        <h2 className="text-lg font-semibold text-slate-800 pr-16">{project.title}</h2>
        {project.description && <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>}
        <p className="text-xs text-slate-400">Updated {updated}</p>
      </Link>
      {/* Hover-revealed actions; always visible on touch devices (no hover). */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${project.title}`}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${project.title}`}
          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
