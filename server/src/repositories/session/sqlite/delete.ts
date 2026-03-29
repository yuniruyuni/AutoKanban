import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Session } from "../../../models/session";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { sessionSpecToSQL } from "./common";

export function del(db: Database, spec: Session.Spec): number {
	const where = compToSQL(
		spec,
		sessionSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM sessions WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
