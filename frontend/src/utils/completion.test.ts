import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../types';
import { computeCompletion, computeCompletionMap } from './completion';

let nextId = 0;

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
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
    children: [],
    ...overrides,
  };
}

describe('computeCompletion', () => {
  it('returns 0 for a single incomplete leaf', () => {
    const leaf = makeNode({ is_complete: false });
    expect(computeCompletion(leaf)).toBe(0);
  });

  it('returns 1 for a single complete leaf', () => {
    const leaf = makeNode({ is_complete: true });
    expect(computeCompletion(leaf)).toBe(1);
  });

  it('averages two equal-weight children, one complete, to 0.5', () => {
    const childA = makeNode({ weight: 1, is_complete: true });
    const childB = makeNode({ weight: 1, is_complete: false });
    const root = makeNode({ children: [childA, childB] });
    expect(computeCompletion(root)).toBe(0.5);
  });

  it('weights children by weight (3 vs 1) to get 0.75', () => {
    const heavy = makeNode({ weight: 3, is_complete: true });
    const light = makeNode({ weight: 1, is_complete: false });
    const root = makeNode({ children: [heavy, light] });
    expect(computeCompletion(root)).toBe(0.75);
  });

  it('rolls up a 3-level tree correctly', () => {
    // Grandchildren under mid: one complete (weight 1), one incomplete (weight 1) -> mid = 0.5
    const grandchildA = makeNode({ weight: 1, is_complete: true });
    const grandchildB = makeNode({ weight: 1, is_complete: false });
    const mid = makeNode({ weight: 1, children: [grandchildA, grandchildB] });

    // Sibling leaf under root, complete, weight 1
    const sibling = makeNode({ weight: 1, is_complete: true });

    const root = makeNode({ children: [mid, sibling] });

    // mid completion = 0.5, sibling completion = 1
    // root = (0.5*1 + 1*1) / (1+1) = 0.75
    expect(computeCompletion(mid)).toBe(0.5);
    expect(computeCompletion(root)).toBe(0.75);
  });

  it('returns 0 when children weights sum to 0', () => {
    const childA = makeNode({ weight: 0, is_complete: true });
    const childB = makeNode({ weight: 0, is_complete: false });
    const root = makeNode({ children: [childA, childB] });
    expect(computeCompletion(root)).toBe(0);
  });
});

describe('computeCompletionMap', () => {
  it('returns null-safe empty map for a null root', () => {
    const map = computeCompletionMap(null);
    expect(map.size).toBe(0);
  });

  it('matches computeCompletion(root) for the root entry and has every node id', () => {
    const grandchildA = makeNode({ weight: 1, is_complete: true });
    const grandchildB = makeNode({ weight: 1, is_complete: false });
    const mid = makeNode({ weight: 1, children: [grandchildA, grandchildB] });
    const sibling = makeNode({ weight: 1, is_complete: true });
    const root = makeNode({ children: [mid, sibling] });

    const map = computeCompletionMap(root);

    expect(map.get(root.id)).toBe(computeCompletion(root));
    expect(map.get(mid.id)).toBe(computeCompletion(mid));

    for (const id of [root.id, mid.id, sibling.id, grandchildA.id, grandchildB.id]) {
      expect(map.has(id)).toBe(true);
    }
    expect(map.size).toBe(5);
  });
});
