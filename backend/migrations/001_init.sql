-- 001_init.sql — initial schema: users, projects, task_nodes
-- Completion % is computed client-side and never stored (see plan.md Part 3).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users -------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One account per email. Unique index doubles as the lookup index for login.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Projects ----------------------------------------------------------------
-- root_node_id references task_nodes, which references projects — a cycle.
-- The column is declared here; its FK constraint is added after task_nodes
-- exists (see ALTER below).
CREATE TABLE projects (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  root_node_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_user_id_idx ON projects (user_id);

-- Task nodes --------------------------------------------------------------
CREATE TABLE task_nodes (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  parent_id    uuid REFERENCES task_nodes (id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  weight       double precision NOT NULL DEFAULT 1.0,
  is_complete  boolean NOT NULL DEFAULT false,
  is_collapsed boolean NOT NULL DEFAULT false,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_nodes_project_id_idx ON task_nodes (project_id);
CREATE INDEX task_nodes_parent_id_idx ON task_nodes (parent_id);

-- Now that task_nodes exists, wire the project's root pointer. If the root
-- node is deleted directly, null the pointer rather than deleting the project.
ALTER TABLE projects
  ADD CONSTRAINT projects_root_node_id_fkey
  FOREIGN KEY (root_node_id) REFERENCES task_nodes (id) ON DELETE SET NULL;
