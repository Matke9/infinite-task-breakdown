import { describe, expect, it } from 'vitest';
import type { TaskNode } from '../types';
import { buildTree, computeDepthMap } from './tree';

let nextId = 0;

function makeFlatNode(overrides: Partial<TaskNode> = {}): TaskNode {
  nextId += 1;
  return {
    id: `node-${nextId}`,
    project_id: 'project-1',
    parent_id: null,
    title: `Node ${nextId}`,
    description: '',
    weight: 1,
    is_complete: false,
    is_collapsed: false,
    position: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildTree', () => {
  it('returns null for an empty list', () => {
    expect(buildTree([])).toBeNull();
  });

  it('builds a root with children sorted by position, regardless of input order', () => {
    const root = makeFlatNode({ id: 'root', parent_id: null, position: 0 });
    const childB = makeFlatNode({ id: 'child-b', parent_id: 'root', position: 1 });
    const childA = makeFlatNode({ id: 'child-a', parent_id: 'root', position: 0 });

    // Deliberately out of position order.
    const tree = buildTree([childB, root, childA]);

    expect(tree).not.toBeNull();
    expect(tree?.id).toBe('root');
    expect(tree?.children.map((c) => c.id)).toEqual(['child-a', 'child-b']);
  });

  it('skips orphan nodes (parent_id pointing to a missing id) instead of throwing', () => {
    const root = makeFlatNode({ id: 'root', parent_id: null, position: 0 });
    const orphan = makeFlatNode({ id: 'orphan', parent_id: 'missing-parent', position: 0 });

    expect(() => buildTree([root, orphan])).not.toThrow();

    const tree = buildTree([root, orphan]);
    expect(tree).not.toBeNull();
    expect(tree?.id).toBe('root');
    expect(tree?.children).toHaveLength(0);
  });
});

describe('computeDepthMap', () => {
  it('assigns root=1, children=2, grandchildren=3', () => {
    const root = makeFlatNode({ id: 'root', parent_id: null, position: 0 });
    const child = makeFlatNode({ id: 'child', parent_id: 'root', position: 0 });
    const grandchild = makeFlatNode({ id: 'grandchild', parent_id: 'child', position: 0 });

    const tree = buildTree([root, child, grandchild]);
    const depths = computeDepthMap(tree);

    expect(depths.get('root')).toBe(1);
    expect(depths.get('child')).toBe(2);
    expect(depths.get('grandchild')).toBe(3);
  });

  it('returns an empty map for a null root', () => {
    const depths = computeDepthMap(null);
    expect(depths.size).toBe(0);
  });
});
