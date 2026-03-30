import type { PgDatabase } from "../../common";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { dateToSQL } from "../../common";

export async function upsert(
	db: PgDatabase,
	workspaceRepo: WorkspaceRepo,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO workspace_repos (id, workspace_id, project_id, target_branch, pr_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       target_branch = excluded.target_branch,
       pr_url = excluded.pr_url,
       updated_at = excluded.updated_at`,
		params: [
			workspaceRepo.id,
			workspaceRepo.workspaceId,
			workspaceRepo.projectId,
			workspaceRepo.targetBranch,
			workspaceRepo.prUrl,
			dateToSQL(workspaceRepo.createdAt),
			dateToSQL(workspaceRepo.updatedAt),
		],
	});
}
