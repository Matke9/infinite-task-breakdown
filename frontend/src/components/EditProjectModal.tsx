import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { projectsApi, getApiErrorMessage } from '../api/client';
import type { Project } from '../types';

interface EditProjectModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSaved: (updated: Project) => void;
}

export default function EditProjectModal({
  open,
  project,
  onClose,
  onSaved,
}: EditProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && project) {
      setTitle(project.title);
      setDescription(project.description);
      setError(null);
      setSubmitting(false);
    }
  }, [open, project]);

  if (!project) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!project) return;

    if (title.trim().length === 0 || description.trim().length === 0) {
      setError('Title and description are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await projectsApi.update(project.id, {
        title: title.trim(),
        description: description.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save changes.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit project">
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-slate-700 mb-1">
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="edit-description"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={5000}
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
