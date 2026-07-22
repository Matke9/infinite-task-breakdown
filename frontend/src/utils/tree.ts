import type { TaskNode, TreeNode } from '../types';

// Build a nested tree from a flat node list. Returns the root node (the one with
// parent_id === null) with children populated recursively, or null if there is no
// root (empty list). Children at every level are sorted by `position` ascending.
export function buildTree(nodes: TaskNode[]): TreeNode | null {
  const byId = new Map<string, TreeNode>();

  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  let root: TreeNode | null = null;

  for (const node of nodes) {
    if (node.parent_id === null) {
      root = byId.get(node.id) ?? null;
      continue;
    }

    const parent = byId.get(node.parent_id);
    const child = byId.get(node.id);
    if (parent && child) {
      parent.children.push(child);
    }
    // Orphan node (parent_id not present in the map): skip attaching it.
  }

  for (const node of byId.values()) {
    node.children.sort((a, b) => a.position - b.position);
  }

  return root;
}

// Depth of a node counting the root as depth 1 (matches the backend's convention,
// where the AI-expand endpoint rejects expansion at depth >= 6). Returns a Map of
// node id -> depth. Root = 1, its children = 2, etc.
export function computeDepthMap(root: TreeNode | null): Map<string, number> {
  const depths = new Map<string, number>();

  if (!root) {
    return depths;
  }

  const walk = (node: TreeNode, depth: number) => {
    depths.set(node.id, depth);
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };

  walk(root, 1);

  return depths;
}
