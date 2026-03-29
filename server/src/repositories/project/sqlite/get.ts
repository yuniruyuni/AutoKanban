import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Project } from "../../../models/project";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type ProjectRow, projectSpecToSQL, rowToProject } from "./common";

export function get(db: Database, spec: Project.Spec): Project | null {
	const where = compToSQL(
		spec,
		projectSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<ProjectRow, SQLQueryBindings[]>(
			`SELECT * FROM projects WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToProject(row) : null;
}
