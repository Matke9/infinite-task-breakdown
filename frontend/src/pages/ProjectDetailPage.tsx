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

  const [expandingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 80 });

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

  function addChild(nodeId: string) {
    void nodeId;
    toast.info('This action lands in the next update.');
  }

  function expandNode(nodeId: string) {
    void nodeId;
    toast.info('This action lands in the next update.');
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

      <div className="flex min-h-0 flex-1">
        <div ref={containerRef} className="relative w-[70%] min-w-0 border-r border-slate-200">
          {loading && (
            <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
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
          )}
        </div>

        <aside className="w-[30%] min-w-0 overflow-y-auto p-4">
          {!selectedNode && (
            <p className="text-sm text-slate-500">Select a task to see details.</p>
          )}
          {selectedNode && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">{selectedNode.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {selectedNode.description || 'No description.'}
              </p>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Weight</dt>
                  <dd className="font-medium text-slate-900">{selectedNode.weight}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Completion</dt>
                  <dd className="font-medium text-slate-900">
                    {Math.round((completionMap.get(selectedNode.id) ?? 0) * 100)}%
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
