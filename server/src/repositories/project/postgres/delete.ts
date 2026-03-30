import type { PgDatabase } from "../../common";
import type { Project } from "../../../models/project";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { projectSpecToSQL } from "./common";

export async function del(db: PgDatabase, spec: Project.Spec): Promise<number> {
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
