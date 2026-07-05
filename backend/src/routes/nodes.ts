import { Router } from 'express';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authMiddleware } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';
import { requireOwnedProject } from './projects';

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
  weight: z.number().min(0).max(100).optional(),
});

const patchNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  weight: z.number().min(0).max(100).optional(),
  is_complete: z.boolean().optional(),
  is_collapsed: z.boolean().optional(),
  position: z.number().int().optional(),
});

async function requireOwnedNode(nodeId: string, userId: string): Promise<NodeRow> {
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
