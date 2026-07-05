import { Router } from 'express';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authMiddleware } from '../middleware/auth';

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

router.get('/', async (req, res) => {
  const result = await query<ProjectRow>(
    'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.userId],
  );
  res.json({ projects: result.rows });
});

router.post('/', async (req, res) => {
  const body = createProjectSchema.parse(req.body);
  const userId = req.userId as string;

  const { project, node } = await withTransaction(async (client: PoolClient) => {
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

    const updatedProjectResult = await client.query<ProjectRow>(
      `UPDATE projects SET root_node_id = $1 WHERE id = $2 RETURNING *`,
      [rootNode.id, insertedProject.id],
    );

    return { project: updatedProjectResult.rows[0], node: rootNode };
  });

  res.status(201).json({ project, nodes: [node] });
});

export default router;
