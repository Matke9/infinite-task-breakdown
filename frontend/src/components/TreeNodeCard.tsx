import type { TaskNode } from '../types';

interface TreeNodeCardProps {
  node: TaskNode;
  completion: number; // 0..1
  depth: number; // root = 1
  childCount: number;
  collapsed: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleComplete: () => void;
  onToggleCollapse: () => void;
  onAddChild: () => void;
  onExpand: () => void;
  expanding: boolean;
}

function completionColor(completion: number): string {
  if (completion < 0.33) return 'bg-red-500';
  if (completion < 0.66) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function TreeNodeCard({
  node,
  completion,
  depth,
  childCount,
  collapsed,
  selected,
  onSelect,
  onToggleComplete,
  onToggleCollapse,
  onAddChild,
  onExpand,
  expanding,
}: TreeNodeCardProps) {
  const pct = Math.round(completion * 100);
  const maxDepthReached = depth >= 6;

  return (
    <div
      onClick={onSelect}
      className={`box-border flex h-full w-full cursor-pointer flex-col rounded-lg bg-white p-3 shadow-sm ${
        selected ? 'ring-2 ring-indigo-500' : 'border border-slate-200'
      }`}
    >
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate text-sm font-medium text-slate-900">{node.title}</span>
        {childCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            aria-label={collapsed ? 'Expand children' : 'Collapse children'}
            className="rounded px-1 text-slate-500 hover:bg-slate-50"
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>

      <div className="mt-2">
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full ${completionColor(completion)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-slate-500">{pct}%</div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2">
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={node.is_complete}
            onChange={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5"
          />
          Done
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          title="Add child task"
          className="rounded border border-slate-200 px-1.5 text-sm hover:bg-slate-50"
        >
          +
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          disabled={maxDepthReached || expanding}
          title={maxDepthReached ? 'Maximum depth (6) reached' : 'AI-expand this task'}
          className="rounded border border-slate-200 px-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {expanding ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          ) : (
            '✨'
          )}
        </button>
      </div>
    </div>
  );
}
