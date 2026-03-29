import type { PgDatabase } from "../../../db/pg-client";
import type { Workspace } from "../../../models/workspace";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	rowToWorkspace,
	type WorkspaceRow,
	workspaceSpecToSQL,
} from "./common";

export async function get(
	db: PgDatabase,
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
