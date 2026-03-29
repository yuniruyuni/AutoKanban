import type { Database } from "bun:sqlite";
import type { Approval } from "../../../models/approval";
import { dateToSQL } from "../../common";

export function upsert(db: Database, approval: Approval): void {
	db.query(
		`INSERT INTO approvals (id, execution_process_id, tool_name, tool_call_id, status, reason, created_at, responded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       reason = excluded.reason,
       responded_at = excluded.responded_at,
       updated_at = excluded.updated_at`,
	).run(
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
