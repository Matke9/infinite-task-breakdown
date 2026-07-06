import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

interface AccessTokenPayload {
  userId: string;
}

export const authMiddleware: RequestHandler = (req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const header = req.header('Authorization');
  const [scheme, token] = header?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as AccessTokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
