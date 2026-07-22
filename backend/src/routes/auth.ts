import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const BCRYPT_ROUNDS = 10;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign({ userId }, secret, {
    expiresIn: '7d',
  });
}

router.post('/signup', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase();

  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE lower(email) = $1',
    [normalizedEmail],
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await query<Pick<UserRow, 'id' | 'email' | 'created_at'>>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [normalizedEmail, passwordHash],
  );
  const user = result.rows[0];

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, created_at: user.created_at },
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase();

  const result = await query<UserRow>(
    'SELECT id, email, password_hash, created_at FROM users WHERE lower(email) = $1',
    [normalizedEmail],
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id);
  res.status(200).json({
    token,
    user: { id: user.id, email: user.email, created_at: user.created_at },
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const result = await query<Pick<UserRow, 'id' | 'email' | 'created_at'>>(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [req.userId],
  );
  const user = result.rows[0];

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
});

export default router;
