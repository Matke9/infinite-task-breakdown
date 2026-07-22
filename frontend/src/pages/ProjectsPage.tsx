import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { projectsApi, getApiErrorMessage } from '../api/client';
import type { Project } from '../types';
import NewProjectModal from '../components/NewProjectModal';
import EditProjectModal from '../components/EditProjectModal';

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    projectsApi
      .list()
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err, 'Could not load projects.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleDelete(p: Project) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await projectsApi.remove(p.id);
      setProjects((prev) => prev.filter((proj) => proj.id !== p.id));
    } catch (err) {
      window.alert(getApiErrorMessage(err, 'Could not delete project.'));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-indigo-600">TaskTree</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your projects</h1>
        </div>

        <div className="mt-6">
          {loading && <p className="text-slate-500">Loading…</p>}

          {!loading && loadError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>
          )}

          {!loading && !loadError && projects.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="font-medium text-slate-700">No projects yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Click the + button to create your first project.
              </p>
            </div>
          )}

          {!loading && !loadError && projects.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="group relative block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-300"
                >
                  <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="Edit project"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditing(p);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label="Delete project"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDelete(p);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      🗑
                    </button>
                  </div>

                  <h2 className="line-clamp-1 pr-14 font-semibold text-slate-900">{p.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>
                  <p className="mt-4 text-xs text-slate-400">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <button
        type="button"
        onClick={() => setShowNew(true)}
        aria-label="New project"
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg transition-colors hover:bg-indigo-700"
      >
        +
      </button>

      <NewProjectModal open={showNew} onClose={() => setShowNew(false)} />
      <EditProjectModal
        open={editing !== null}
        project={editing}
        onClose={() => setEditing(null)}
        onSaved={(u) => setProjects((prev) => prev.map((p) => (p.id === u.id ? u : p)))}
      />
    </div>
  );
}
