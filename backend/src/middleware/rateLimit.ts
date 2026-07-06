import { RequestHandler } from 'express';

// In-memory per-user sliding-window rate limiter for AI-backed routes.
// Not shared across processes; fine for this app's scale (single instance).
const HOUR_MS = 60 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function getLimit(): number {
  const raw = process.env.AI_RATE_LIMIT;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

// Must run AFTER authMiddleware (relies on req.userId).
export const aiRateLimit: RequestHandler = (req, res, next) => {
  const userId = req.userId as string;
  const limit = getLimit();
  const now = Date.now();

  const timestamps = (requestLog.get(userId) ?? []).filter(
    (ts) => now - ts < HOUR_MS,
  );

  if (timestamps.length >= limit) {
    requestLog.set(userId, timestamps);
    res.status(429).json({
      error: `AI rate limit exceeded. You can make ${limit} requests per hour; try again later.`,
    });
    return;
  }

  timestamps.push(now);
  requestLog.set(userId, timestamps);
  next();
};
