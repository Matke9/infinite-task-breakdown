import { Link, useParams } from 'react-router-dom';

export default function ProjectDetailPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link to="/projects" className="font-medium text-indigo-600 hover:text-indigo-700">
          ← Back to projects
        </Link>
        <p className="mt-8 text-center text-slate-500">
          Project detail (id: {id}) — coming in Phase 7.
        </p>
      </div>
    </div>
  );
}
