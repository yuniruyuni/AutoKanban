import type { Database } from "bun:sqlite";
import type { Session } from "../../../models/session";
import { dateToSQL } from "../../common";

export function upsert(db: Database, session: Session): void {
	db.query(
		`INSERT INTO sessions (id, workspace_id, executor, variant, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           executor = excluded.executor,
           variant = excluded.variant,
           updated_at = excluded.updated_at`,
	).run(
		session.id,
		session.workspaceId,
		session.executor,
		session.variant,
		dateToSQL(session.createdAt),
		dateToSQL(session.updatedAt),
	);
}
