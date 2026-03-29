import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type WorkspaceRepoRow,
	rowToWorkspaceRepo,
	workspaceRepoSpecToSQL,
} from "./common";

export function get(
	db: Database,
	spec: WorkspaceRepo.Spec,
): WorkspaceRepo | null {
	const where = compToSQL(
		spec,
		workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<WorkspaceRepoRow, SQLQueryBindings[]>(
			`SELECT * FROM workspace_repos WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToWorkspaceRepo(row) : null;
}
