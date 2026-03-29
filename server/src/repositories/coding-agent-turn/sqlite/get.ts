import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type CodingAgentTurnRow,
	codingAgentTurnSpecToSQL,
	rowToCodingAgentTurn,
} from "./common";

export function get(
	db: Database,
	spec: CodingAgentTurn.Spec,
): CodingAgentTurn | null {
	const where = compToSQL(
		spec,
		codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<CodingAgentTurnRow, SQLQueryBindings[]>(
			`SELECT * FROM coding_agent_turns WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToCodingAgentTurn(row) : null;
}
