import type { Database } from "../../../lib/db/database";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { rowToWorkspaceRepo, type WorkspaceRepoRow } from "./common";

export async function listByWorkspace(
	db: Database,
	workspaceId: string,
): Promise<WorkspaceRepo[]> {
	const rows = await db.queryAll<WorkspaceRepoRow>({
		query:
			"SELECT * FROM workspace_repos WHERE workspace_id = ? ORDER BY created_at ASC",
		params: [workspaceId],
	});

	return rows.map(rowToWorkspaceRepo);
}
