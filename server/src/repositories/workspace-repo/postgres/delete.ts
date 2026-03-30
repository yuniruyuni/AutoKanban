import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { workspaceRepoSpecToSQL } from "./common";

export async function del(
	db: Database,
	spec: WorkspaceRepo.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM workspace_repos WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
