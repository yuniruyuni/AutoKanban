import type { Database } from "../../../infra/db/database";
import type { Workspace } from "../../../models/workspace";
import { rowToWorkspace, type WorkspaceRow } from "./common";

export async function findByWorktreePath(
	db: Database,
	worktreePath: string,
): Promise<Workspace | null> {
	const row = await db.queryGet<WorkspaceRow>({
		query: `SELECT * FROM workspaces WHERE worktree_path = ? LIMIT 1`,
		params: [worktreePath],
	});

	return row ? rowToWorkspace(row) : null;
}
