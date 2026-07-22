export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  root_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  weight: number;
  is_complete: boolean;
  is_collapsed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
