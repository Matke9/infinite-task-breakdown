import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { TaskNode } from '../types';

type EditablePatch = { title?: string; description?: string; weight?: number };

interface NodeDetailPanelProps {
  node: TaskNode; // the currently selected node (fresh from parent)
  depth: number; // root = 1
  expanding: boolean; // AI expand in flight for this node
  isRoot: boolean; // true when depth === 1 (disable delete)
  onEdit: (patch: EditablePatch) => void; // optimistic local update, called on every change
  onSave: (patch: EditablePatch) => void; // persist to API, called debounced
  onToggleComplete: () => void;
  onAddChild: () => void;
  onExpand: () => void;
  onDelete: () => void;
  onRegenerate: () => void; // root-only: replace all children with a fresh AI breakdown
}

const AUTOSAVE_DELAY_MS = 600;

export default function NodeDetailPanel({
  node,
  depth,
  expanding,
  isRoot,
  onEdit,
  onSave,
  onToggleComplete,
  onAddChild,
  onExpand,
  onDelete,
  onRegenerate,
}: NodeDetailPanelProps) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description);
  const [weight, setWeight] = useState(node.weight);
  const [saving, setSaving] = useState(false);

  const timerRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<EditablePatch>({});
  // Keep onSave in a ref so the debounce timer/unmount flush always calls the
  // latest closure without needing to be in effect dependency arrays.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  function scheduleSave(patch: EditablePatch) {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setSaving(true);
    timerRef.current = window.setTimeout(() => {
      const toSave = pendingPatchRef.current;
      pendingPatchRef.current = {};
      timerRef.current = null;
      setSaving(false);
      onSaveRef.current(toSave);
    }, AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        const toSave = pendingPatchRef.current;
        pendingPatchRef.current = {};
        if (Object.keys(toSave).length > 0) {
          onSaveRef.current(toSave);
        }
      }
    };
  }, []);

  function handleTitleChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setTitle(value);
    onEdit({ title: value });
    scheduleSave({ title: value });
  }

  function handleDescriptionChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setDescription(value);
    onEdit({ description: value });
    scheduleSave({ description: value });
  }

  function handleWeightChange(e: ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value);
    setWeight(value);
    onEdit({ weight: value });
    scheduleSave({ weight: value });
  }

  const maxDepthReached = depth >= 6;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="node-title" className="block text-sm font-medium text-slate-700 mb-1">
          Title
        </label>
        <input
          id="node-title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          maxLength={200}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="node-description" className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          id="node-description"
          rows={4}
          value={description}
          onChange={handleDescriptionChange}
          maxLength={5000}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="node-weight" className="block text-sm font-medium text-slate-700 mb-1">
          Weight: {weight}
        </label>
        <input
          id="node-weight"
          type="range"
          min={1}
          max={10}
          step={1}
          value={weight}
          onChange={handleWeightChange}
          className="w-full"
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={node.is_complete}
            onChange={onToggleComplete}
            className="h-4 w-4"
          />
          Mark complete
        </label>
        <span className="text-xs text-slate-400">{saving ? 'Saving…' : ''}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onExpand}
          disabled={maxDepthReached || expanding}
          title={maxDepthReached ? 'Maximum depth (6) reached' : undefined}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {expanding ? (
            <>
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-white" />
              Generating…
            </>
          ) : (
            '✨ Generate subtasks with AI'
          )}
        </button>

        {isRoot && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={expanding}
            title="Delete the current breakdown and generate a fresh one with AI"
            className="inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🔄 Regenerate breakdown
          </button>
        )}

        <button
          type="button"
          onClick={onAddChild}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          + Add subtask manually
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={isRoot}
          title={isRoot ? 'Delete the project from the top bar instead' : undefined}
          className="inline-flex items-center justify-center rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete this task
        </button>
      </div>
    </div>
  );
}
