import { api } from './client'

export interface Project {
  id: string
  user_id: string
  title: string
  description: string
  root_node_id: string | null
  created_at: string
  updated_at: string
}

export const listProjects = () =>
  api.get<{ projects: Project[] }>('/api/projects').then((r) => r.data.projects)

export const updateProject = (id: string, patch: { title?: string; description?: string }) =>
  api.patch<{ project: Project }>(`/api/projects/${id}`, patch).then((r) => r.data.project)

export const deleteProject = (id: string) => api.delete(`/api/projects/${id}`).then(() => undefined)
