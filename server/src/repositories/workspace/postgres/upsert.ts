import type { Database } from "../../common";
import type { Workspace } from "../../../models/workspace";
import { dateToSQL } from "../../common";

export async function upsert(
	db: Database,
	workspace: Workspace,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO workspaces (id, task_id, container_ref, branch, worktree_path, setup_complete, attempt, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           container_ref = excluded.container_ref,
           branch = excluded.branch,
           worktree_path = excluded.worktree_path,
           setup_complete = excluded.setup_complete,
           attempt = excluded.attempt,
           archived = excluded.archived,
           updated_at = excluded.updated_at`,
		params: [
			workspace.id,
			workspace.taskId,
			workspace.containerRef,
			workspace.branch,
			workspace.worktreePath,
			workspace.setupComplete,
			workspace.attempt,
			workspace.archived,
			dateToSQL(workspace.createdAt),
			dateToSQL(workspace.updatedAt),
		],
	});
}
