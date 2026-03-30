import type { PgDatabase } from "../../common";
import type { Workspace } from "../../../models/workspace";
import { rowToWorkspace, type WorkspaceRow } from "./common";

export async function findByWorktreePath(
	db: PgDatabase,
	worktreePath: string,
): Promise<Workspace | null> {
	const row = await db.queryGet<WorkspaceRow>({
		query: `SELECT * FROM workspaces WHERE worktree_path = ? LIMIT 1`,
		params: [worktreePath],
	});

	return row ? rowToWorkspace(row) : null;
}
