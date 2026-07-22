import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Tree from 'react-d3-tree';
import type { CustomNodeElementProps, RawNodeDatum } from 'react-d3-tree';
import { projectsApi, nodesApi, getApiErrorMessage } from '../api/client';
import type { Project, TaskNode, TreeNode } from '../types';
import { buildTree, computeDepthMap } from '../utils/tree';
import { computeCompletionMap } from '../utils/completion';
import { toast } from '../store/toast';
import TreeNodeCard from '../components/TreeNodeCard';
import NodeDetailPanel from '../components/NodeDetailPanel';
import Skeleton from '../components/Skeleton';
import NestedTaskList from '../components/NestedTaskList';
import { useMediaQuery } from '../hooks/useMediaQuery';

function completionColor(completion: number): string {
  if (completion < 0.33) return 'bg-red-500';
  if (completion < 0.66) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function buildNodesById(root: TreeNode | null): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  if (!root) return map;
  const walk = (node: TreeNode) => {
    map.set(node.id, node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return map;
}

function toD3(node: TreeNode, collapsed: Set<string>): RawNodeDatum {
  return {
    name: node.title,
    attributes: { id: node.id },
    children: collapsed.has(node.id)
      ? undefined
      : node.children.map((child) => toD3(child, collapsed)),
  };
}

function collectSubtreeIds(node: TreeNode): string[] {
  const ids: string[] = [];
  const walk = (n: TreeNode) => {
    ids.push(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return ids;
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const cancelTitleEditRef = useRef(false);

  const [expandingId, setExpandingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 80 });
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    projectsApi
      .get(id)
      .then(({ project: loadedProject, nodes: loadedNodes }) => {
        if (cancelled) return;
        setProject(loadedProject);
        setNodes(loadedNodes);
        setCollapsed(new Set(loadedNodes.filter((n) => n.is_collapsed).map((n) => n.id)));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err, 'Could not load project.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    function updateTranslate() {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setTranslate({ x: width / 2, y: 80 });
      }
    }
    updateTranslate();
    window.addEventListener('resize', updateTranslate);
    return () => window.removeEventListener('resize', updateTranslate);
  }, []);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const completionMap = useMemo(() => computeCompletionMap(tree), [tree]);
  const depthMap = useMemo(() => computeDepthMap(tree), [tree]);
  const nodesById = useMemo(() => buildNodesById(tree), [tree]);
  const d3Data = useMemo(() => (tree ? toD3(tree, collapsed) : null), [tree, collapsed]);
  const overall = tree ? (completionMap.get(tree.id) ?? 0) : 0;
  const selectedNode = selectedId ? (nodesById.get(selectedId) ?? null) : null;

  async function toggleComplete(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const next = !node.is_complete;
    const previous = nodes;
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, is_complete: next } : n)));
    try {
      await nodesApi.update(nodeId, { is_complete: next });
    } catch (err) {
      setNodes(previous);
      toast.error(getApiErrorMessage(err, 'Could not update task.'));
    }
  }

  function toggleCollapse(nodeId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  function select(nodeId: string) {
    setSelectedId(nodeId);
  }

  async function addChild(nodeId: string) {
    if (!project) return;
    const siblings = nodes.filter((n) => n.parent_id === nodeId);
    const position = siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0;
    const tempId = `temp-${crypto.randomUUID()}`;
    const temp: TaskNode = {
      id: tempId,
      project_id: project.id,
      parent_id: nodeId,
      title: 'New subtask',
      description: '',
      weight: 1,
      is_complete: false,
      is_collapsed: false,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setNodes((prev) => [...prev, temp]);
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.delete(nodeId);
      return n;
    });
    try {
      const created = await nodesApi.create({ project_id: project.id, parent_id: nodeId, title: 'New subtask' });
      setNodes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
      setSelectedId(created.id);
    } catch (err) {
      setNodes((prev) => prev.filter((n) => n.id !== tempId));
      toast.error(getApiErrorMessage(err, 'Could not add subtask.'));
    }
  }

  async function expandNode(nodeId: string) {
    setExpandingId(nodeId);
    try {
      const children = await nodesApi.expand(nodeId);
      if (children.length === 0) {
        toast.info('The AI did not return any subtasks — try rephrasing this task, then expand again.');
        return;
      }
      setNodes((prev) => [...prev, ...children]);
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(nodeId);
        return n;
      });
      toast.success(`Generated ${children.length} subtask${children.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not generate subtasks.'));
    } finally {
      setExpandingId(null);
    }
  }

  async function deleteNode(nodeId: string) {
    const treeNode = nodesById.get(nodeId);
    if (!treeNode) return;
    const subtreeIds = collectSubtreeIds(treeNode);
    const descendantCount = subtreeIds.length - 1;
    const message =
      descendantCount > 0
        ? `This deletes ${descendantCount} subtask${descendantCount === 1 ? '' : 's'}. Continue?`
        : `Delete "${treeNode.title}"?`;
    if (!window.confirm(message)) return;
    const previous = nodes;
    const toRemove = new Set(subtreeIds);
    setNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));
    if (selectedId && toRemove.has(selectedId)) setSelectedId(null);
    try {
      await nodesApi.remove(nodeId);
      toast.success('Task deleted.');
    } catch (err) {
      setNodes(previous);
      toast.error(getApiErrorMessage(err, 'Could not delete task.'));
    }
  }

  // Root-only "regenerate breakdown": deletes the root's existing subtrees, then
  // re-runs the AI breakdown. Destructive + multi-step, so on both success and
  // failure we resync from the server rather than trust optimistic local state.
  async function regenerateBreakdown(nodeId: string) {
    if (!id) return;
    const treeNode = nodesById.get(nodeId);
    if (!treeNode) return;
    const childCount = treeNode.children.length;
    const message =
      childCount > 0
        ? `Regenerate the breakdown? This deletes the current ${childCount} top-level subtask${childCount === 1 ? '' : 's'} (and everything under them), then asks the AI for a fresh breakdown.`
        : 'Generate an AI breakdown for this project?';
    if (!window.confirm(message)) return;
    setExpandingId(nodeId);
    try {
      for (const child of treeNode.children) {
        await nodesApi.remove(child.id);
      }
      const children = await nodesApi.expand(nodeId);
      const fresh = await projectsApi.get(id);
      setNodes(fresh.nodes);
      setSelectedId(null);
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(nodeId);
        return n;
      });
      if (children.length === 0) {
        toast.info('The AI did not return any subtasks — try editing the project description, then regenerate.');
      } else {
        toast.success(`Regenerated — ${children.length} subtask${children.length === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      try {
        const fresh = await projectsApi.get(id);
        setNodes(fresh.nodes);
        setSelectedId(null);
      } catch {
        // leave local state as-is if the resync also fails
      }
      toast.error(getApiErrorMessage(err, 'Could not regenerate breakdown.'));
    } finally {
      setExpandingId(null);
    }
  }

  function editNodeLocal(nodeId: string, patch: { title?: string; description?: string; weight?: number }) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
  }

  async function saveNode(nodeId: string, patch: { title?: string; description?: string; weight?: number }) {
    try {
      const updated = await nodesApi.update(nodeId, patch);
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? updated : n)));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save changes.'));
    }
  }

  function startEditTitle() {
    if (!project) return;
    setTitleDraft(project.title);
    cancelTitleEditRef.current = false;
    setEditingTitle(true);
  }

  async function saveTitle() {
    if (!project) return;
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed.length === 0 || trimmed === project.title) return;
    const previous = project;
    setProject({ ...project, title: trimmed });
    try {
      const updated = await projectsApi.update(project.id, { title: trimmed });
      setProject(updated);
    } catch (err) {
      setProject(previous);
      toast.error(getApiErrorMessage(err, 'Could not save project title.'));
    }
  }

  function handleTitleBlur() {
    if (cancelTitleEditRef.current) {
      cancelTitleEditRef.current = false;
      setEditingTitle(false);
      return;
    }
    void saveTitle();
  }

  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      cancelTitleEditRef.current = true;
      e.currentTarget.blur();
    }
  }

  async function deleteProject() {
    if (!project) return;
    if (!window.confirm(`Delete project "${project.title}"? This cannot be undone.`)) return;
    try {
      await projectsApi.remove(project.id);
      navigate('/projects');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not delete project.'));
    }
  }

  function renderNode({ nodeDatum }: CustomNodeElementProps): ReactElement {
    const nodeId = nodeDatum.attributes?.id as string | undefined;
    const treeNode = nodeId ? nodesById.get(nodeId) : undefined;
    if (!nodeId || !treeNode) {
      return <g />;
    }
    return (
      <g>
        <foreignObject x={-120} y={-75} width={240} height={150} style={{ overflow: 'visible' }}>
          <TreeNodeCard
            node={treeNode}
            completion={completionMap.get(nodeId) ?? 0}
            depth={depthMap.get(nodeId) ?? 1}
            childCount={treeNode.children.length}
            collapsed={collapsed.has(nodeId)}
            selected={selectedId === nodeId}
            onSelect={() => select(nodeId)}
            onToggleComplete={() => toggleComplete(nodeId)}
            onToggleCollapse={() => toggleCollapse(nodeId)}
            onAddChild={() => addChild(nodeId)}
            onExpand={() => expandNode(nodeId)}
            expanding={expandingId === nodeId}
          />
        </foreignObject>
      </g>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <Link
          to="/projects"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          ← Projects
        </Link>

        {project && editingTitle && (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            maxLength={200}
            className="rounded-md border border-slate-300 px-2 py-1 text-lg font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        )}
        {project && !editingTitle && (
          <button
            type="button"
            onClick={startEditTitle}
            title="Click to rename"
            className="max-w-xs truncate text-lg font-semibold text-slate-900 hover:underline"
          >
            {project.title}
          </button>
        )}

        <div className="flex-1" />

        {tree && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-40 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${completionColor(overall)}`}
                style={{ width: `${Math.round(overall * 100)}%` }}
              />
            </div>
            <span className="text-sm text-slate-600">{Math.round(overall * 100)}% complete</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => void deleteProject()}
          disabled={!project}
          className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={containerRef}
          className="relative min-h-0 flex-1 border-b border-slate-200 lg:w-[70%] lg:flex-none lg:border-b-0 lg:border-r"
        >
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Skeleton className="h-20 w-56 rounded-lg" />
              <div className="flex gap-4">
                <Skeleton className="h-16 w-40 rounded-lg" />
                <Skeleton className="h-16 w-40 rounded-lg" />
                <Skeleton className="h-16 w-40 rounded-lg" />
              </div>
            </div>
          )}

          {!loading && loadError && (
            <div className="flex h-full items-center justify-center p-4">
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {loadError}
              </div>
            </div>
          )}

          {!loading && !loadError && !tree && (
            <div className="flex h-full items-center justify-center text-slate-500">
              This project has no tasks yet.
            </div>
          )}

          {!loading && !loadError && tree && d3Data && (
            isDesktop ? (
              <Tree
                data={d3Data}
                orientation="vertical"
                pathFunc="step"
                collapsible={false}
                renderCustomNodeElement={renderNode}
                nodeSize={{ x: 260, y: 170 }}
                separation={{ siblings: 1.1, nonSiblings: 1.3 }}
                translate={translate}
                zoomable
                scaleExtent={{ min: 0.3, max: 1.5 }}
                zoom={0.8}
              />
            ) : (
              <NestedTaskList
                root={tree}
                completionMap={completionMap}
                collapsed={collapsed}
                selectedId={selectedId}
                expandingId={expandingId}
                onSelect={select}
                onToggleComplete={toggleComplete}
                onToggleCollapse={toggleCollapse}
                onAddChild={(id) => void addChild(id)}
                onExpand={(id) => void expandNode(id)}
              />
            )
          )}
        </div>

        <aside className="max-h-[45vh] min-h-0 overflow-y-auto p-4 lg:max-h-none lg:w-[30%]">
          {!selectedNode && (
            <p className="text-sm text-slate-500">Select a task to see details.</p>
          )}
          {selectedNode && (
            <NodeDetailPanel
              key={selectedNode.id}
              node={selectedNode}
              depth={depthMap.get(selectedNode.id) ?? 1}
              expanding={expandingId === selectedNode.id}
              isRoot={(depthMap.get(selectedNode.id) ?? 1) === 1}
              onEdit={(patch) => editNodeLocal(selectedNode.id, patch)}
              onSave={(patch) => void saveNode(selectedNode.id, patch)}
              onToggleComplete={() => toggleComplete(selectedNode.id)}
              onAddChild={() => void addChild(selectedNode.id)}
              onExpand={() => void expandNode(selectedNode.id)}
              onDelete={() => void deleteNode(selectedNode.id)}
              onRegenerate={() => void regenerateBreakdown(selectedNode.id)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
