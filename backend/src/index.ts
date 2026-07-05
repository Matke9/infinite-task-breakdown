import 'dotenv/config';
import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import { NotFoundError } from './lib/errors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.issues });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

app.listen(PORT, () => {
  console.log(`API listening on ${PORT} (${NODE_ENV})`);
});
