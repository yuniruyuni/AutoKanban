import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { AgentSetting } from "../../../models/agent-setting";
import {
	type AgentSettingRow,
	agentSettingSpecToSQL,
	rowToAgentSetting,
} from "./common";

export async function get(
	db: Database,
	spec: AgentSetting.Spec,
): Promise<AgentSetting | null> {
	const where = compToSQL(
		spec,
		agentSettingSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<AgentSettingRow>({
		query: `SELECT * FROM agent_settings WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToAgentSetting(row) : null;
}
