import type { TreeNode } from '../types';

// Leaf node: is_complete ? 1 : 0.
// Parent node: weighted average of children's completion =
//   sum(child.completion * child.weight) / sum(child.weight).
// If a parent somehow has children whose weights sum to 0, return 0 (avoid /0).
export function computeCompletion(node: TreeNode): number {
  if (node.children.length === 0) {
    return node.is_complete ? 1 : 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const child of node.children) {
    const childCompletion = computeCompletion(child);
    weightedSum += childCompletion * child.weight;
    totalWeight += child.weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return weightedSum / totalWeight;
}

// One bottom-up pass returning id -> completion for EVERY node in the tree, so the
// tree renderer can look up each node's % without recomputing. Uses the same rule.
export function computeCompletionMap(root: TreeNode | null): Map<string, number> {
  const completions = new Map<string, number>();

  if (!root) {
    return completions;
  }

  const walk = (node: TreeNode): number => {
    let completion: number;

    if (node.children.length === 0) {
      completion = node.is_complete ? 1 : 0;
    } else {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const child of node.children) {
        const childCompletion = walk(child);
        weightedSum += childCompletion * child.weight;
        totalWeight += child.weight;
      }
      completion = totalWeight === 0 ? 0 : weightedSum / totalWeight;
    }

    completions.set(node.id, completion);
    return completion;
  };

  walk(root);

  return completions;
}
