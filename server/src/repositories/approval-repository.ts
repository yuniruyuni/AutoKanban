import type { Database, SQLQueryBindings } from "bun:sqlite";
import { Approval } from "../models/approval";
import type { Cursor, Page } from "../models/common";
import type { IApprovalRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface ApprovalRow {
	id: string;
	execution_process_id: string;
	tool_name: string;
	tool_call_id: string;
	status: string;
	reason: string | null;
	created_at: string;
	responded_at: string | null;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type ApprovalSpecData =
	| { type: "ById"; id: string }
	| { type: "ByExecutionProcessId"; executionProcessId: string }
	| { type: "ByStatus"; status: Approval.Status };

function approvalSpecToSQL(spec: ApprovalSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByExecutionProcessId":
			return sql`execution_process_id = ${spec.executionProcessId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToApproval(row: ApprovalRow): Approval {
	return {
		id: row.id,
		executionProcessId: row.execution_process_id,
		toolName: row.tool_name,
		toolCallId: row.tool_call_id,
		status: row.status as Approval.Status,
		reason: row.reason,
		createdAt: dateFromSQL(row.created_at),
		respondedAt: row.responded_at ? dateFromSQL(row.responded_at) : null,
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// Approval Repository
// ============================================

export class ApprovalRepository implements IApprovalRepository {
	constructor(private db: Database) {}

	get(spec: Approval.Spec): Approval | null {
		const where = compToSQL(
			spec,
			approvalSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<ApprovalRow, SQLQueryBindings[]>(
				`SELECT * FROM approvals WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToApproval(row) : null;
	}

	list(spec: Approval.Spec, cursor: Cursor<Approval.SortKey>): Page<Approval> {
		const where = compToSQL(
			spec,
			approvalSpecToSQL as (s: unknown) => SQLFragment,
		);

		const sort = cursor.sort ?? Approval.defaultSort;
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		const limit = cursor.limit + 1;

		const rows = this.db
			.query<ApprovalRow, SQLQueryBindings[]>(
				`SELECT * FROM approvals WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToApproval);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Approval.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	upsert(approval: Approval): void {
		this.db
			.query(
				`INSERT INTO approvals (id, execution_process_id, tool_name, tool_call_id, status, reason, created_at, responded_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           reason = excluded.reason,
           responded_at = excluded.responded_at,
           updated_at = excluded.updated_at`,
			)
			.run(
				approval.id,
				approval.executionProcessId,
				approval.toolName,
				approval.toolCallId,
				approval.status,
				approval.reason,
				dateToSQL(approval.createdAt),
				approval.respondedAt ? dateToSQL(approval.respondedAt) : null,
				dateToSQL(approval.updatedAt),
			);
	}

	delete(spec: Approval.Spec): number {
		const where = compToSQL(
			spec,
			approvalSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM approvals WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: Approval.SortKey): string {
		const map: Record<Approval.SortKey, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			id: "id",
		};
		return map[key];
	}
}
