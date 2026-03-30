import type { Database } from "../../common";

export async function getMaxAttempt(
	db: Database,
	taskId: string,
): Promise<number> {
	const row = await db.queryGet<{ max_attempt: number | null }>({
		query: `SELECT MAX(attempt) as max_attempt FROM workspaces WHERE task_id = ?`,
		params: [taskId],
	});

	return row?.max_attempt ?? 0;
}
