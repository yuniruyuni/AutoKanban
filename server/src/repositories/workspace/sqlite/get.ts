import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Workspace } from "../../../models/workspace";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type WorkspaceRow, rowToWorkspace, workspaceSpecToSQL } from "./common";

export function get(db: Database, spec: Workspace.Spec): Workspace | null {
	const where = compToSQL(
		spec,
		workspaceSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<WorkspaceRow, SQLQueryBindings[]>(
			`SELECT * FROM workspaces WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToWorkspace(row) : null;
}
