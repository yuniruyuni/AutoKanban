import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Project } from "../../../models/project";
import { type ProjectRow, projectSpecToSQL, rowToProject } from "./common";

export async function get(
	db: Database,
	spec: Project.Spec,
): Promise<Project | null> {
	const where = compToSQL(
		spec,
		projectSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<ProjectRow>({
		query: `SELECT * FROM projects WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToProject(row) : null;
}
