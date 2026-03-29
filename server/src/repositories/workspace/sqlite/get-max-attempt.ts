import type { Database } from "bun:sqlite";

export function getMaxAttempt(db: Database, taskId: string): number {
	const row = db
		.query<{ max_attempt: number | null }, [string]>(
			`SELECT MAX(attempt) as max_attempt FROM workspaces WHERE task_id = ?`,
		)
		.get(taskId);

	return row?.max_attempt ?? 0;
}
