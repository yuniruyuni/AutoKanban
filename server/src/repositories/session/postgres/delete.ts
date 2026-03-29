import type { PgDatabase } from "../../../db/pg-client";
import type { Session } from "../../../models/session";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { sessionSpecToSQL } from "./common";

export async function del(
	db: PgDatabase,
	spec: Session.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		sessionSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM sessions WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
