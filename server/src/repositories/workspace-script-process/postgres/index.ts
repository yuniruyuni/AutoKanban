import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL, dateToSQL } from "../../../infra/db/sql-helpers";
import type { Cursor, Page } from "../../../models/common";
import { WorkspaceScriptProcess } from "../../../models/workspace-script-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { WorkspaceScriptProcessRepository as IWorkspaceScriptProcessRepository } from "../repository";
import {
	columnName,
	rowToWorkspaceScriptProcess,
	type WorkspaceScriptProcessRow,
	workspaceScriptProcessSpecToSQL,
} from "./common";

export class WorkspaceScriptProcessRepository
	implements IWorkspaceScriptProcessRepository
{
	async get(
		ctx: DbReadCtx,
		spec: WorkspaceScriptProcess.Spec,
	): Promise<WorkspaceScriptProcess | null> {
		const where = compToSQL(
			spec,
			workspaceScriptProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = await ctx.db.queryGet<WorkspaceScriptProcessRow>({
			query: `SELECT * FROM workspace_script_processes WHERE ${where.query} LIMIT 1`,
			params: where.params,
		});
		return row ? rowToWorkspaceScriptProcess(row) : null;
	}

	async list(
		ctx: DbReadCtx,
		spec: WorkspaceScriptProcess.Spec,
		cursor: Cursor<WorkspaceScriptProcess.SortKey>,
	): Promise<Page<WorkspaceScriptProcess>> {
		const where = compToSQL(
			spec,
			workspaceScriptProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const sort = cursor.sort ?? {
			keys: ["startedAt", "id"] as const,
			order: "desc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");
		const limit = cursor.limit + 1;

		const rows = await ctx.db.queryAll<WorkspaceScriptProcessRow>({
			query: `SELECT * FROM workspace_script_processes WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			params: where.params,
		});

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToWorkspaceScriptProcess);
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? WorkspaceScriptProcess.cursor(lastItem, sort.keys)
				: undefined;

		return { items, hasMore, nextCursor };
	}

	async upsert(
		ctx: DbWriteCtx,
		process: WorkspaceScriptProcess,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO workspace_script_processes (id, session_id, script_type, status, exit_code, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           exit_code = excluded.exit_code,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`,
			params: [
				process.id,
				process.sessionId,
				process.scriptType,
				process.status,
				process.exitCode,
				dateToSQL(process.startedAt),
				process.completedAt ? dateToSQL(process.completedAt) : null,
				dateToSQL(process.createdAt),
				dateToSQL(process.updatedAt),
			],
		});
	}

	async delete(
		ctx: DbWriteCtx,
		spec: WorkspaceScriptProcess.Spec,
	): Promise<number> {
		const where = compToSQL(
			spec,
			workspaceScriptProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = await ctx.db.queryRun({
			query: `DELETE FROM workspace_script_processes WHERE ${where.query}`,
			params: where.params,
		});
		return result.rowCount;
	}
}
