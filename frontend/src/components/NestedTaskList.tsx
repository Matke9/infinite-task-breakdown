import { Fragment } from 'react';
import type { TreeNode } from '../types';

interface NestedTaskListProps {
  root: TreeNode;
  completionMap: Map<string, number>;
  collapsed: Set<string>;
  selectedId: string | null;
  expandingId: string | null;
  onSelect: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddChild: (id: string) => void;
  onExpand: (id: string) => void;
}

function completionTextColor(completion: number): string {
  if (completion < 0.33) return 'text-red-600';
  if (completion < 0.66) return 'text-amber-600';
  return 'text-emerald-600';
}

function completionBarColor(completion: number): string {
  if (completion < 0.33) return 'bg-red-500';
  if (completion < 0.66) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function NestedTaskList({
  root,
  completionMap,
  collapsed,
  selectedId,
  expandingId,
  onSelect,
  onToggleComplete,
  onToggleCollapse,
  onAddChild,
  onExpand,
}: NestedTaskListProps) {
  function renderNode(node: TreeNode, depth: number) {
    const pct = Math.round((completionMap.get(node.id) ?? 0) * 100);
    const isSelected = selectedId === node.id;
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const maxDepthReached = depth >= 6;
    const isExpanding = expandingId === node.id;

    return (
      <Fragment key={node.id}>
        <div
          style={{ paddingLeft: `${(depth - 1) * 20}px` }}
          className="mb-1"
        >
          <div
            className={`flex items-center gap-2 rounded-md border px-2 py-2 ${
              isSelected
                ? 'border-transparent bg-indigo-50/40 ring-2 ring-indigo-500'
                : 'border-slate-200 bg-white'
            }`}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
                aria-label={isCollapsed ? 'Expand children' : 'Collapse children'}
                className="w-4 shrink-0 text-center text-slate-500 hover:bg-slate-50"
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            <input
              type="checkbox"
              checked={node.is_complete}
              onChange={(e) => {
                e.stopPropagation();
                onToggleComplete(node.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 shrink-0"
            />

            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className="flex-1 truncate text-left text-sm font-medium text-slate-900"
            >
              {node.title}
            </button>

            <div className="flex w-10 shrink-0 flex-col items-end gap-0.5">
              <div className="h-1.5 w-10 rounded-full bg-slate-100">
                <div
                  className={`h-1.5 rounded-full ${completionBarColor(completionMap.get(node.id) ?? 0)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs tabular-nums ${completionTextColor(completionMap.get(node.id) ?? 0)}`}>
                {pct}%
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
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
                onExpand(node.id);
              }}
              disabled={maxDepthReached || isExpanding}
              title={maxDepthReached ? 'Maximum depth (6) reached' : 'AI-expand this task'}
              className="rounded border border-slate-200 px-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExpanding ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              ) : (
                '✨'
              )}
            </button>
          </div>
        </div>
        {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </Fragment>
    );
  }

  return <div className="h-full overflow-y-auto p-3">{renderNode(root, 1)}</div>;
}
