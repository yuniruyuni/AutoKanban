import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Session } from "../../../models/session";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type SessionRow, rowToSession, sessionSpecToSQL } from "./common";

export function get(db: Database, spec: Session.Spec): Session | null {
	const where = compToSQL(
		spec,
		sessionSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<SessionRow, SQLQueryBindings[]>(
			`SELECT * FROM sessions WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToSession(row) : null;
}
