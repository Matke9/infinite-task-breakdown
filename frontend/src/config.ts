// Central place to read Vite-exposed env vars. Only `VITE_`-prefixed vars are
// bundled into the client (Vite statically replaces `import.meta.env.VITE_*`).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
