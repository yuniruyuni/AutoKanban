-- Auto Kanban Database Schema (PostgreSQL)

-- projects (Project = 1 Git Repository)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  repo_path TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL DEFAULT 'main',
  setup_script TEXT,
  cleanup_script TEXT,
  dev_server_script TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

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

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  executor TEXT,
  variant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);

-- execution_processes
CREATE TABLE IF NOT EXISTS execution_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  run_reason TEXT NOT NULL DEFAULT 'setupscript',
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_processes_session_id ON execution_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_processes_status ON execution_processes(status);

-- execution_process_logs
CREATE TABLE IF NOT EXISTS execution_process_logs (
  execution_process_id TEXT PRIMARY KEY REFERENCES execution_processes(id),
  logs TEXT NOT NULL DEFAULT ''
);

-- coding_agent_turns (tracks Claude Code agent session info for resume)
CREATE TABLE IF NOT EXISTS coding_agent_turns (
  id TEXT PRIMARY KEY,
  execution_process_id TEXT NOT NULL UNIQUE REFERENCES execution_processes(id),
  agent_session_id TEXT,
  agent_message_id TEXT,
  prompt TEXT,
  summary TEXT,
  seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_agent_turns_agent_session ON coding_agent_turns(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_coding_agent_turns_execution_process ON coding_agent_turns(execution_process_id);

-- workspace_repos
CREATE TABLE IF NOT EXISTS workspace_repos (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  target_branch TEXT NOT NULL,
  pr_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, project_id)
);

-- approvals (permission/plan approval requests, DB-persisted)
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  execution_process_id TEXT NOT NULL REFERENCES execution_processes(id),
  tool_name TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_execution_process_id ON approvals(execution_process_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- variants (configuration variants for executors)
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  executor TEXT NOT NULL,
  name TEXT NOT NULL,
  permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions',
  model TEXT,
  append_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(executor, name)
);

-- tools
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  icon_color TEXT NOT NULL DEFAULT '#6B7280',
  command TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- project_task_templates (default tasks created with new projects)
CREATE TABLE IF NOT EXISTS project_task_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  condition TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
