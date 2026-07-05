import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

interface AccessTokenPayload {
  userId: string;
}

export const authMiddleware: RequestHandler = (req, res, next) => {
  const header = req.header('Authorization');
  const [scheme, token] = header?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as AccessTokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
