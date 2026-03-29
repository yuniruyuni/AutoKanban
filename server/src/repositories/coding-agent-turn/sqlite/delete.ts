import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { codingAgentTurnSpecToSQL } from "./common";

export function del(db: Database, spec: CodingAgentTurn.Spec): number {
	const where = compToSQL(
		spec,
		codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM coding_agent_turns WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
