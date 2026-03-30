import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Cursor, Page } from "../../../models/common";
import { WorkspaceRepo } from "../../../models/workspace-repo";
import {
	columnName,
	rowToWorkspaceRepo,
	type WorkspaceRepoRow,
	workspaceRepoSpecToSQL,
} from "./common";

export async function list(
	db: Database,
	spec: WorkspaceRepo.Spec,
	cursor: Cursor<WorkspaceRepo.SortKey>,
): Promise<Page<WorkspaceRepo>> {
	const where = compToSQL(
		spec,
		workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? {
		keys: ["createdAt", "id"] as const,
		order: "asc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<WorkspaceRepoRow>({
		query: `SELECT * FROM workspace_repos WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToWorkspaceRepo);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? WorkspaceRepo.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
