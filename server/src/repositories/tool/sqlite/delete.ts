import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { toolSpecToSQL } from "./common";

export function del(db: Database, spec: Tool.Spec): number {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM tools WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
