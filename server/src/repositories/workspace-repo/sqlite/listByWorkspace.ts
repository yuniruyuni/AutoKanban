import type { Database } from "bun:sqlite";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { type WorkspaceRepoRow, rowToWorkspaceRepo } from "./common";

export function listByWorkspace(
	db: Database,
	workspaceId: string,
): WorkspaceRepo[] {
	const rows = db
		.query<WorkspaceRepoRow, [string]>(
			"SELECT * FROM workspace_repos WHERE workspace_id = ? ORDER BY created_at ASC",
		)
		.all(workspaceId);

	return rows.map(rowToWorkspaceRepo);
}
