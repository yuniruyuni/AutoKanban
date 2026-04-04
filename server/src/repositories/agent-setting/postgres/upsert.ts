import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";
import type { AgentSetting } from "../../../models/agent-setting";

export async function upsert(
	db: Database,
	setting: AgentSetting,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO agent_settings (agent_id, command, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       command = excluded.command,
       updated_at = excluded.updated_at`,
		params: [
			setting.agentId,
			setting.command,
			dateToSQL(setting.createdAt),
			dateToSQL(setting.updatedAt),
		],
	});
}
