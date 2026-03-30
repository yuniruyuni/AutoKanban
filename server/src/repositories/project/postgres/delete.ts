import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Project } from "../../../models/project";
import { projectSpecToSQL } from "./common";

export async function del(db: Database, spec: Project.Spec): Promise<number> {
	const where = compToSQL(
		spec,
		projectSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM projects WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
