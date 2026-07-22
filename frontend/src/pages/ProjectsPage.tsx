import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight">TaskTree</span>
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

      <div className="flex justify-center px-4 py-24 text-slate-500">
        Your projects will appear here.
      </div>
    </div>
  );
}
