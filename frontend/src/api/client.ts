import axios from 'axios';
import { API_URL } from '../config';
import type { AuthResponse, Project, TaskNode, User } from '../types';

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export const authApi = {
  signup(email: string, password: string): Promise<AuthResponse> {
    return api.post('/auth/signup', { email, password }).then((r) => r.data);
  },
  login(email: string, password: string): Promise<AuthResponse> {
    return api.post('/auth/login', { email, password }).then((r) => r.data);
  },
  me(): Promise<User> {
    return api.get('/auth/me').then((r) => r.data.user);
  },
};

export const nodesApi = {
  create(input: {
    project_id: string;
    parent_id: string | null;
    title: string;
    description?: string;
    weight?: number;
  }): Promise<TaskNode> {
    return api.post('/nodes', input).then((r) => r.data.node);
  },
  update(
    id: string,
    patch: {
      title?: string;
      description?: string;
      weight?: number;
      is_complete?: boolean;
      is_collapsed?: boolean;
      position?: number;
    },
  ): Promise<TaskNode> {
    return api.patch(`/nodes/${id}`, patch).then((r) => r.data.node);
  },
  remove(id: string): Promise<void> {
    return api.delete(`/nodes/${id}`).then(() => undefined);
  },
  expand(id: string): Promise<TaskNode[]> {
    return api.post(`/nodes/${id}/expand`).then((r) => r.data.nodes);
  },
};

export const projectsApi = {
  list(): Promise<Project[]> {
    return api.get('/projects').then((r) => r.data.projects);
  },
  get(id: string): Promise<{ project: Project; nodes: TaskNode[] }> {
    return api.get(`/projects/${id}`).then((r) => r.data);
  },
  create(title: string, description: string): Promise<{ project: Project; nodes: TaskNode[] }> {
    return api.post('/projects', { title, description }).then((r) => r.data);
  },
  update(id: string, patch: { title?: string; description?: string }): Promise<Project> {
    return api.patch(`/projects/${id}`, patch).then((r) => r.data.project);
  },
  remove(id: string): Promise<void> {
    return api.delete(`/projects/${id}`).then(() => undefined);
  },
};
