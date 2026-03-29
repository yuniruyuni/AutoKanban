import type { PgDatabase } from "../../../db/pg-client";
import type { Workspace } from "../../../models/workspace";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { workspaceSpecToSQL } from "./common";

export async function del(
	db: PgDatabase,
	spec: Workspace.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		workspaceSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM workspaces WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
