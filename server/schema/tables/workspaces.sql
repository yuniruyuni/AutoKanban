-- workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  container_ref TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT '',
  worktree_path TEXT,
  setup_complete BOOLEAN DEFAULT false,
  attempt INTEGER NOT NULL DEFAULT 1,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_task_id ON workspaces(task_id);
