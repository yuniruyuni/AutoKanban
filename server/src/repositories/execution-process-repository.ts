import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { ExecutionProcess } from "../models/execution-process";
import type { IExecutionProcessRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface ExecutionProcessRow {
	id: string;
	session_id: string;
	run_reason: string;
	status: string;
	exit_code: number | null;
	started_at: string;
	completed_at: string | null;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type ExecutionProcessSpecData =
	| { type: "ById"; id: string }
	| { type: "BySessionId"; sessionId: string }
	| { type: "ByStatus"; status: ExecutionProcess.Status }
	| { type: "ByRunReason"; runReason: ExecutionProcess.RunReason };

function executionProcessSpecToSQL(
	spec: ExecutionProcessSpecData,
): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "BySessionId":
			return sql`session_id = ${spec.sessionId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
		case "ByRunReason":
			return sql`run_reason = ${spec.runReason}`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToExecutionProcess(row: ExecutionProcessRow): ExecutionProcess {
	return {
		id: row.id,
		sessionId: row.session_id,
		runReason: row.run_reason as ExecutionProcess.RunReason,
		status: row.status as ExecutionProcess.Status,
		exitCode: row.exit_code,
		startedAt: dateFromSQL(row.started_at),
		completedAt: row.completed_at ? dateFromSQL(row.completed_at) : null,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// Execution Process Repository
// ============================================

export class ExecutionProcessRepository implements IExecutionProcessRepository {
	constructor(private db: Database) {}

	get(spec: ExecutionProcess.Spec): ExecutionProcess | null {
		const where = compToSQL(
			spec,
			executionProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<ExecutionProcessRow, SQLQueryBindings[]>(
				`SELECT * FROM execution_processes WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToExecutionProcess(row) : null;
	}

	list(
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Page<ExecutionProcess> {
		const where = compToSQL(
			spec,
			executionProcessSpecToSQL as (s: unknown) => SQLFragment,
		);

		const sort = cursor.sort ?? {
			keys: ["startedAt", "id"] as const,
			order: "desc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		const limit = cursor.limit + 1;

		const rows = this.db
			.query<ExecutionProcessRow, SQLQueryBindings[]>(
				`SELECT * FROM execution_processes WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToExecutionProcess);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? ExecutionProcess.cursor(lastItem, sort.keys)
				: undefined;

		return { items, hasMore, nextCursor };
	}

	upsert(process: ExecutionProcess): void {
		this.db
			.query(
				`INSERT INTO execution_processes (id, session_id, run_reason, status, exit_code, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           exit_code = excluded.exit_code,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`,
			)
			.run(
				process.id,
				process.sessionId,
				process.runReason,
				process.status,
				process.exitCode,
				dateToSQL(process.startedAt),
				process.completedAt ? dateToSQL(process.completedAt) : null,
				dateToSQL(process.createdAt),
				dateToSQL(process.updatedAt),
			);
	}

	delete(spec: ExecutionProcess.Spec): number {
		const where = compToSQL(
			spec,
			executionProcessSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM execution_processes WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: ExecutionProcess.SortKey): string {
		const map: Record<ExecutionProcess.SortKey, string> = {
			createdAt: "created_at",
			startedAt: "started_at",
			id: "id",
		};
		return map[key];
	}
}
