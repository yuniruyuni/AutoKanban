import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL, dateToSQL } from "../../../infra/db/sql-helpers";
import type { Cursor, Page } from "../../../models/common";
import { DevServerProcess } from "../../../models/dev-server-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { DevServerProcessRepository as IDevServerProcessRepository } from "../repository";
import {
	columnName,
	type DevServerProcessRow,
	devServerProcessSpecToSQL,
	rowToDevServerProcess,
} from "./common";

export class DevServerProcessRepository implements IDevServerProcessRepository {
	async get(
		ctx: DbReadCtx,
		spec: DevServerProcess.Spec,
	): Promise<DevServerProcess | null> {
		const where = compToSQL(
			spec,
			devServerProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = await ctx.db.queryGet<DevServerProcessRow>({
			query: `SELECT * FROM dev_server_processes WHERE ${where.query} LIMIT 1`,
			params: where.params,
		});
		return row ? rowToDevServerProcess(row) : null;
	}

	async list(
		ctx: DbReadCtx,
		spec: DevServerProcess.Spec,
		cursor: Cursor<DevServerProcess.SortKey>,
	): Promise<Page<DevServerProcess>> {
		const where = compToSQL(
			spec,
			devServerProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const sort = cursor.sort ?? {
			keys: ["startedAt", "id"] as const,
			order: "desc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");
		const limit = cursor.limit + 1;

		const rows = await ctx.db.queryAll<DevServerProcessRow>({
			query: `SELECT * FROM dev_server_processes WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			params: where.params,
		});

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToDevServerProcess);
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? DevServerProcess.cursor(lastItem, sort.keys)
				: undefined;

		return { items, hasMore, nextCursor };
	}

	async upsert(ctx: DbWriteCtx, process: DevServerProcess): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO dev_server_processes (id, session_id, status, exit_code, proxy_port, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           exit_code = excluded.exit_code,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`,
			params: [
				process.id,
				process.sessionId,
				process.status,
				process.exitCode,
				process.proxyPort,
				dateToSQL(process.startedAt),
				process.completedAt ? dateToSQL(process.completedAt) : null,
				dateToSQL(process.createdAt),
				dateToSQL(process.updatedAt),
			],
		});
	}

	async delete(ctx: DbWriteCtx, spec: DevServerProcess.Spec): Promise<number> {
		const where = compToSQL(
			spec,
			devServerProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = await ctx.db.queryRun({
			query: `DELETE FROM dev_server_processes WHERE ${where.query}`,
			params: where.params,
		});
		return result.rowCount;
	}
}
