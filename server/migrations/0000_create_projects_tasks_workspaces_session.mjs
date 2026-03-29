// Automatically created by 'sqlite auto migrator (SAM)' on 2026-03-29T14:06:02.786Z

import { Database } from 'sqlite-auto-migrator';

// Pragmas can't be changed in transactions, so they are tracked separately.
// Note that most pragmas are not persisted in the database file and will have to be set on each new connection.
export const PRAGMAS = {"analysis_limit":0,"application_id":0,"auto_vacuum":0,"automatic_index":1,"timeout":0,"cache_size":2000,"cache_spill":20000,"cell_size_check":0,"checkpoint_fullfsync":1,"seq":0,"name":"tools","compile_options":"ATOMIC_INTRINSICS=1","count_changes":0,"data_version":1,"file":"/private/var/folders/h7/_zhk66ds6q5ghs4f0l77ntjh0000gn/T/nwehWN/temp.db","defer_foreign_keys":0,"empty_result_callbacks":0,"encoding":"UTF-8","foreign_keys":0,"freelist_count":0,"full_column_names":0,"fullfsync":0,"builtin":1,"type":"table","enc":"utf8","narg":2,"flags":2099200,"hard_heap_limit":0,"ignore_check_constraints":0,"integrity_check":"ok","journal_mode":"delete","journal_size_limit":32768,"legacy_alter_table":1,"locking_mode":"normal","max_page_count":1073741823,"mmap_size":0,"page_count":41,"page_size":4096,"query_only":0,"quick_check":"ok","read_uncommitted":0,"recursive_triggers":0,"reverse_unordered_selects":0,"schema_version":22,"secure_delete":2,"short_column_names":1,"soft_heap_limit":0,"synchronous":2,"schema":"main","ncol":8,"wr":0,"strict":0,"temp_store":0,"threads":0,"trusted_schema":1,"user_version":0,"wal_autocheckpoint":1000,"busy":0,"log":-1,"checkpointed":-1,"writable_schema":0};

/**
 * Runs the necessary SQL commands to migrate the database up to this version from the previous version.
 * Automatically runs in a transaction with deferred foreign keys.
 * @param {Database} db database instance to run SQL commands on
 */
export async function up(db) {
    await db.run("CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT,repo_path TEXT NOT NULL UNIQUE,branch TEXT NOT NULL DEFAULT 'main',setup_script TEXT,cleanup_script TEXT,dev_server_script TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),title TEXT NOT NULL,description TEXT,status TEXT NOT NULL DEFAULT 'todo',created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE workspaces(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),container_ref TEXT NOT NULL,branch TEXT NOT NULL DEFAULT '',worktree_path TEXT,setup_complete INTEGER DEFAULT 0,attempt INTEGER NOT NULL DEFAULT 1,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE sessions(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),executor TEXT,variant TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE execution_processes(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id),run_reason TEXT NOT NULL DEFAULT 'setupscript',status TEXT NOT NULL DEFAULT 'running',exit_code INTEGER,started_at TEXT NOT NULL DEFAULT(datetime('now')),completed_at TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE execution_process_logs(execution_process_id TEXT PRIMARY KEY REFERENCES execution_processes(id),logs TEXT NOT NULL DEFAULT '')");
    await db.run("CREATE TABLE coding_agent_turns(id TEXT PRIMARY KEY,execution_process_id TEXT NOT NULL UNIQUE REFERENCES execution_processes(id),agent_session_id TEXT,agent_message_id TEXT,prompt TEXT,summary TEXT,seen INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE workspace_repos(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),project_id TEXT NOT NULL REFERENCES projects(id),target_branch TEXT NOT NULL,pr_url TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(workspace_id,project_id))");
    await db.run("CREATE TABLE approvals(id TEXT PRIMARY KEY,execution_process_id TEXT NOT NULL REFERENCES execution_processes(id),tool_name TEXT NOT NULL,tool_call_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),responded_at TEXT,updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE variants(id TEXT PRIMARY KEY,executor TEXT NOT NULL,name TEXT NOT NULL,permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions',model TEXT,append_prompt TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(executor,name))");
    await db.run("CREATE TABLE tools(id TEXT PRIMARY KEY,name TEXT NOT NULL,icon TEXT NOT NULL,icon_color TEXT NOT NULL DEFAULT '#6B7280',command TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE TABLE project_task_templates(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT,condition TEXT,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')))");
    await db.run("CREATE INDEX idx_tasks_project_id ON tasks(project_id)");
    await db.run("CREATE INDEX idx_tasks_status ON tasks(status)");
    await db.run("CREATE INDEX idx_workspaces_task_id ON workspaces(task_id)");
    await db.run("CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id)");
    await db.run("CREATE INDEX idx_execution_processes_session_id ON execution_processes(session_id)");
    await db.run("CREATE INDEX idx_execution_processes_status ON execution_processes(status)");
    await db.run("CREATE INDEX idx_coding_agent_turns_agent_session ON coding_agent_turns(agent_session_id)");
    await db.run("CREATE INDEX idx_coding_agent_turns_execution_process ON coding_agent_turns(execution_process_id)");
    await db.run("CREATE INDEX idx_approvals_execution_process_id ON approvals(execution_process_id)");
    await db.run("CREATE INDEX idx_approvals_status ON approvals(status)");
}

/**
 * Runs the necessary SQL commands to migrate the database down to the previous version from this version.
 * Automatically runs in a transaction with deferred foreign keys.
 * @param {Database} db database instance to run SQL commands on
 */
export async function down(db) {
    await db.run("DROP INDEX \"idx_tasks_project_id\"");
    await db.run("DROP INDEX \"idx_tasks_status\"");
    await db.run("DROP INDEX \"idx_workspaces_task_id\"");
    await db.run("DROP INDEX \"idx_sessions_workspace_id\"");
    await db.run("DROP INDEX \"idx_execution_processes_session_id\"");
    await db.run("DROP INDEX \"idx_execution_processes_status\"");
    await db.run("DROP INDEX \"idx_coding_agent_turns_agent_session\"");
    await db.run("DROP INDEX \"idx_coding_agent_turns_execution_process\"");
    await db.run("DROP INDEX \"idx_approvals_execution_process_id\"");
    await db.run("DROP INDEX \"idx_approvals_status\"");
    await db.run("DROP TABLE \"projects\"");
    await db.run("DROP TABLE \"tasks\"");
    await db.run("DROP TABLE \"workspaces\"");
    await db.run("DROP TABLE \"sessions\"");
    await db.run("DROP TABLE \"execution_processes\"");
    await db.run("DROP TABLE \"execution_process_logs\"");
    await db.run("DROP TABLE \"coding_agent_turns\"");
    await db.run("DROP TABLE \"workspace_repos\"");
    await db.run("DROP TABLE \"approvals\"");
    await db.run("DROP TABLE \"variants\"");
    await db.run("DROP TABLE \"tools\"");
    await db.run("DROP TABLE \"project_task_templates\"");
}