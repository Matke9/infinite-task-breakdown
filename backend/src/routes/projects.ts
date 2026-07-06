import { Router } from 'express';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authMiddleware } from '../middleware/auth';
import { aiRateLimit } from '../middleware/rateLimit';
import { NotFoundError } from '../lib/errors';
import { callGemini } from '../ai/client';
import { initialBreakdownPrompt, breakdownResponseSchema, breakdownSchema } from '../ai/prompts';

const router = Router();
router.use(authMiddleware);

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  root_node_id: string | null;
  created_at: Date;
  updated_at: Date;
}

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

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
});

const patchProjectSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: 'At least one field must be provided',
  });

export async function requireOwnedProject(
  projectId: string,
  userId: string,
): Promise<ProjectRow> {
  const result = await query<ProjectRow>(
    'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, userId],
  );
  if (result.rows.length === 0) {
    throw new NotFoundError();
  }
  return result.rows[0];
}

router.get('/', async (req, res) => {
  const result = await query<ProjectRow>(
    'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.userId],
  );
  res.json({ projects: result.rows });
});

router.post('/', aiRateLimit, async (req, res) => {
  const body = createProjectSchema.parse(req.body);
  const userId = req.userId as string;

  // Deviates from plan.md's "create project, then call AI": we call Gemini
  // BEFORE any DB writes so we're not holding a transaction open across the
  // ~2.5s AI HTTP call. If Gemini throws, nothing is created (no orphan
  // project/root node) and the error propagates to the central handler (502).
  const breakdown = await callGemini(
    initialBreakdownPrompt(body.title, body.description ?? ''),
    breakdownResponseSchema,
    breakdownSchema,
  );

  const { project, nodes } = await withTransaction(async (client: PoolClient) => {
    const projectResult = await client.query<ProjectRow>(
      `INSERT INTO projects (user_id, title, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, body.title, body.description ?? ''],
    );
    const insertedProject = projectResult.rows[0];

    const nodeResult = await client.query<NodeRow>(
      `INSERT INTO task_nodes (project_id, parent_id, title, position)
       VALUES ($1, NULL, $2, 0)
       RETURNING *`,
      [insertedProject.id, body.title],
    );
    const rootNode = nodeResult.rows[0];

    const childNodes: NodeRow[] = [];
    for (let i = 0; i < breakdown.subtasks.length; i++) {
      const subtask = breakdown.subtasks[i];
      const childResult = await client.query<NodeRow>(
        `INSERT INTO task_nodes (project_id, parent_id, title, description, weight, position)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [insertedProject.id, rootNode.id, subtask.title, subtask.description, subtask.weight, i],
      );
      childNodes.push(childResult.rows[0]);
    }

    const updatedProjectResult = await client.query<ProjectRow>(
      `UPDATE projects SET root_node_id = $1 WHERE id = $2 RETURNING *`,
      [rootNode.id, insertedProject.id],
    );

    return { project: updatedProjectResult.rows[0], nodes: [rootNode, ...childNodes] };
  });

  res.status(201).json({ project, nodes });
});

router.get('/:id', async (req, res) => {
  const project = await requireOwnedProject(req.params.id, req.userId as string);

  const nodesResult = await query<NodeRow>(
    'SELECT * FROM task_nodes WHERE project_id = $1 ORDER BY position, created_at',
    [project.id],
  );

  res.json({ project, nodes: nodesResult.rows });
});

router.patch('/:id', async (req, res) => {
  const body = patchProjectSchema.parse(req.body);
  await requireOwnedProject(req.params.id, req.userId as string);

  const result = await query<ProjectRow>(
    `UPDATE projects
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [body.title ?? null, body.description ?? null, req.params.id],
  );

  res.json({ project: result.rows[0] });
});

router.delete('/:id', async (req, res) => {
  await requireOwnedProject(req.params.id, req.userId as string);
  await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

export default router;
