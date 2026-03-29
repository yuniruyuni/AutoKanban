import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Workspace } from "../../../models/workspace";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { workspaceSpecToSQL } from "./common";

export function del(db: Database, spec: Workspace.Spec): number {
	const where = compToSQL(
		spec,
		workspaceSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM workspaces WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
