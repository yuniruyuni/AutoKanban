import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { workspaceRepoSpecToSQL } from "./common";

export function del(db: Database, spec: WorkspaceRepo.Spec): number {
	const where = compToSQL(
		spec,
		workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM workspace_repos WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
