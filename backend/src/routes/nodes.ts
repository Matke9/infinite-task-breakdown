import { Router } from 'express';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authMiddleware } from '../middleware/auth';
import { aiRateLimit } from '../middleware/rateLimit';
import { NotFoundError } from '../lib/errors';
import { requireOwnedProject } from './projects';
import { callGemini } from '../ai/client';
import { expandNodePrompt, breakdownResponseSchema, breakdownSchema } from '../ai/prompts';

// Root node = depth 1. Nodes at depth >= MAX_DEPTH may not be expanded further.
const MAX_DEPTH = 6;

const router = Router();
router.use(authMiddleware);

interface NodeRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  weight: number;
  is_complete: boolean;
  is_collapsed: boolean;
  position: number;
  created_at: Date;
  updated_at: Date;
}

const createNodeSchema = z.object({
  project_id: z.uuid(),
  parent_id: z.uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  weight: z.number().min(1).max(10).optional(),
});

const patchNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  weight: z.number().min(0).max(100).optional(),
  is_complete: z.boolean().optional(),
  is_collapsed: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function requireOwnedNode(nodeId: string, userId: string): Promise<NodeRow> {
  const result = await query<NodeRow>(
    `SELECT tn.*
     FROM task_nodes tn
     JOIN projects p ON p.id = tn.project_id
     WHERE tn.id = $1 AND p.user_id = $2`,
    [nodeId, userId],
  );
  if (result.rows.length === 0) {
    throw new NotFoundError();
  }
  return result.rows[0];
}

router.post('/', async (req, res) => {
  const body = createNodeSchema.parse(req.body);
  const userId = req.userId as string;

  await requireOwnedProject(body.project_id, userId);

  const parentId = body.parent_id ?? null;
  if (parentId !== null) {
    const parentResult = await query<{ id: string }>(
      'SELECT id FROM task_nodes WHERE id = $1 AND project_id = $2',
      [parentId, body.project_id],
    );
    if (parentResult.rows.length === 0) {
      throw new NotFoundError();
    }
  }

  const node = await withTransaction(async (client: PoolClient) => {
    const maxPositionResult = await client.query<{ max_position: number | null }>(
      `SELECT MAX(position) AS max_position
       FROM task_nodes
       WHERE project_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [body.project_id, parentId],
    );
    const nextPosition = (maxPositionResult.rows[0].max_position ?? -1) + 1;

    const nodeResult = await client.query<NodeRow>(
      `INSERT INTO task_nodes (project_id, parent_id, title, description, weight, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        body.project_id,
        parentId,
        body.title,
        body.description ?? '',
        body.weight ?? 1.0,
        nextPosition,
      ],
    );

    await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [
      body.project_id,
    ]);

    return nodeResult.rows[0];
  });

  res.status(201).json({ node });
});

interface AncestorRow {
  id: string;
  parent_id: string | null;
  title: string;
  depth: number;
}

router.post<{ id: string }>('/:id/expand', aiRateLimit, async (req, res) => {
  const userId = req.userId as string;
  const node = await requireOwnedNode(req.params.id, userId);

  // Walk parent links upward from this node to the root. Each row's `depth`
  // counts steps from the node (1) up to that ancestor; the row count and
  // the root row's depth both equal the node's true tree depth (root = 1).
  const ancestryResult = await query<AncestorRow>(
    `WITH RECURSIVE anc AS (
       SELECT id, parent_id, title, 1 AS depth FROM task_nodes WHERE id = $1
       UNION ALL
       SELECT tn.id, tn.parent_id, tn.title, anc.depth + 1
         FROM task_nodes tn JOIN anc ON tn.id = anc.parent_id
     )
     SELECT * FROM anc ORDER BY depth DESC;`,
    [node.id],
  );
  const ancestry = ancestryResult.rows;
  // The CTE's `depth` column counts steps from the target node up to each
  // ancestor, starting at 1 for the node itself. So `ancestry.length` (== the
  // depth value on the root row, which sorts first under ORDER BY DESC) is
  // exactly the node's true tree depth under the "root = 1" convention.
  const nodeDepth = ancestry.length;

  // Reject BEFORE calling Gemini — the depth-limit test must make zero AI calls.
  if (nodeDepth >= MAX_DEPTH) {
    res.status(422).json({ error: 'Maximum depth reached' });
    return;
  }

  // ancestry is ordered root-first (root has the highest `depth` value, the
  // node itself has depth 1, and we sorted DESC), so joining titles in this
  // order gives root > ... > node.
  const breadcrumb = ancestry.map((row) => row.title).join(' > ');

  const project = await requireOwnedProject(node.project_id, userId);

  const expansion = await callGemini(
    expandNodePrompt(project.title, breadcrumb, node.title, node.description),
    breakdownResponseSchema,
    breakdownSchema,
  );

  const nodes = await withTransaction(async (client: PoolClient) => {
    const maxPositionResult = await client.query<{ max_position: number | null }>(
      `SELECT MAX(position) AS max_position FROM task_nodes WHERE parent_id = $1`,
      [node.id],
    );
    const startPosition = (maxPositionResult.rows[0].max_position ?? -1) + 1;

    const childNodes: NodeRow[] = [];
    for (let i = 0; i < expansion.subtasks.length; i++) {
      const subtask = expansion.subtasks[i];
      const childResult = await client.query<NodeRow>(
        `INSERT INTO task_nodes (project_id, parent_id, title, description, weight, position)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          node.project_id,
          node.id,
          subtask.title,
          subtask.description,
          subtask.weight,
          startPosition + i,
        ],
      );
      childNodes.push(childResult.rows[0]);
    }

    await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [
      node.project_id,
    ]);

    return childNodes;
  });

  res.status(201).json({ nodes });
});

router.patch('/:id', async (req, res) => {
  const body = patchNodeSchema.parse(req.body);
  const userId = req.userId as string;
  const existing = await requireOwnedNode(req.params.id, userId);

  const node = await withTransaction(async (client: PoolClient) => {
    const result = await client.query<NodeRow>(
      `UPDATE task_nodes
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           weight = COALESCE($3, weight),
           is_complete = COALESCE($4, is_complete),
           is_collapsed = COALESCE($5, is_collapsed),
           position = COALESCE($6, position),
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        body.title ?? null,
        body.description ?? null,
        body.weight ?? null,
        body.is_complete ?? null,
        body.is_collapsed ?? null,
        body.position ?? null,
        req.params.id,
      ],
    );

    await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [
      existing.project_id,
    ]);

    return result.rows[0];
  });

  res.json({ node });
});

router.delete('/:id', async (req, res) => {
  const userId = req.userId as string;
  const existing = await requireOwnedNode(req.params.id, userId);

  await withTransaction(async (client: PoolClient) => {
    await client.query('DELETE FROM task_nodes WHERE id = $1', [req.params.id]);
    await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [
      existing.project_id,
    ]);
  });

  res.status(204).end();
});

export default router;
