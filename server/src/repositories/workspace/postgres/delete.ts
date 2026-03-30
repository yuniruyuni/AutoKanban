import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Workspace } from "../../../models/workspace";
import { workspaceSpecToSQL } from "./common";

export async function del(db: Database, spec: Workspace.Spec): Promise<number> {
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
