import type { Database } from "bun:sqlite";
import type { Workspace } from "../../../models/workspace";
import { rowToWorkspace, type WorkspaceRow } from "./common";

export function findByWorktreePath(
	db: Database,
	worktreePath: string,
): Workspace | null {
	const row = db
		.query<WorkspaceRow, [string]>(
			`SELECT * FROM workspaces WHERE worktree_path = ? LIMIT 1`,
		)
		.get(worktreePath);

	return row ? rowToWorkspace(row) : null;
}
