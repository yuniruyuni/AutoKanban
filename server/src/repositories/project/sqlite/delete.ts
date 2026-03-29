import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Project } from "../../../models/project";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { projectSpecToSQL } from "./common";

export function del(db: Database, spec: Project.Spec): number {
	const where = compToSQL(
		spec,
		projectSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM projects WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
