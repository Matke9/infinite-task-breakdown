import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
});
