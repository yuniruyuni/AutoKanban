import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type ToolRow, rowToTool, toolSpecToSQL } from "./common";

export function get(db: Database, spec: Tool.Spec): Tool | null {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const row = db
		.query<ToolRow, SQLQueryBindings[]>(
			`SELECT * FROM tools WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToTool(row) : null;
}
