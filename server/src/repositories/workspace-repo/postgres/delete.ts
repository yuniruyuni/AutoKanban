import type { Database } from "../../common";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
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
