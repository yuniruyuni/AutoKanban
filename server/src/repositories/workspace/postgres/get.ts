import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Workspace } from "../../../models/workspace";
import {
	rowToWorkspace,
	type WorkspaceRow,
	workspaceSpecToSQL,
} from "./common";

export async function get(
	db: Database,
	spec: Workspace.Spec,
): Promise<Workspace | null> {
	const where = compToSQL(
		spec,
		workspaceSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<WorkspaceRow>({
		query: `SELECT * FROM workspaces WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToWorkspace(row) : null;
}
