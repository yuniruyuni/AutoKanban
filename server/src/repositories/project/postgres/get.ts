import type { PgDatabase } from "../../../db/pg-client";
import type { Project } from "../../../models/project";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { type ProjectRow, projectSpecToSQL, rowToProject } from "./common";

export async function get(
	db: PgDatabase,
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
