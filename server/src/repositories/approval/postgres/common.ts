import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { Approval } from "../../../models/approval";

export interface ApprovalRow {
	id: string;
	execution_process_id: string;
	tool_name: string;
	tool_call_id: string;
	status: string;
	reason: string | null;
	created_at: Date;
	responded_at: Date | null;
	updated_at: Date;
}

type ApprovalSpecData =
	| { type: "ById"; id: string }
	| { type: "ByExecutionProcessId"; executionProcessId: string }
	| { type: "ByStatus"; status: Approval.Status };

export function approvalSpecToSQL(spec: ApprovalSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByExecutionProcessId":
			return sql`execution_process_id = ${spec.executionProcessId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
	}
}

export function rowToApproval(row: ApprovalRow): Approval {
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

export function columnName(key: Approval.SortKey): string {
	const map: Record<Approval.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
