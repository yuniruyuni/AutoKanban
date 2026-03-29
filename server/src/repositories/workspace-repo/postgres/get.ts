import type { PgDatabase } from "../../../db/pg-client";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	rowToWorkspaceRepo,
	type WorkspaceRepoRow,
	workspaceRepoSpecToSQL,
} from "./common";

export async function get(
	db: PgDatabase,
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
