-- coding_agent_turns (tracks Claude Code agent session info for resume)
CREATE TABLE IF NOT EXISTS coding_agent_turns (
  id TEXT PRIMARY KEY,
  execution_process_id TEXT NOT NULL UNIQUE,
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
