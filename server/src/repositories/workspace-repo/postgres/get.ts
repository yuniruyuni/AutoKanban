import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import {
	rowToWorkspaceRepo,
	type WorkspaceRepoRow,
	workspaceRepoSpecToSQL,
} from "./common";

export async function get(
	db: Database,
	spec: WorkspaceRepo.Spec,
): Promise<WorkspaceRepo | null> {
	const where = compToSQL(
		spec,
		workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<WorkspaceRepoRow>({
		query: `SELECT * FROM workspace_repos WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToWorkspaceRepo(row) : null;
}
