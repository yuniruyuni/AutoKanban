import type { PgDatabase } from "../../repositories/common";

/**
 * Recovers orphaned processes after server restart.
 * Running/awaiting_approval processes no longer have OS processes
 * and must be marked as killed. Associated tasks are transitioned
 * to 'inreview' so users can see the task needs attention.
 *
 * @param db - The database instance
 * @returns The number of processes that were recovered (marked as killed)
 */
export async function recoverOrphanedProcesses(
	db: PgDatabase,
): Promise<number> {
	const now = new Date().toISOString();

	// Move tasks associated with orphaned processes to 'inreview'.
	await db.queryRun({
		query: `
    UPDATE tasks SET status = 'inreview', updated_at = $1
    WHERE status IN ('inprogress', 'inreview')
      AND id IN (
        SELECT w.task_id
        FROM execution_processes ep
        JOIN sessions s ON ep.session_id = s.id
        JOIN workspaces w ON s.workspace_id = w.id
        WHERE ep.status IN ('running', 'awaiting_approval')
          AND w.task_id IS NOT NULL
      )
  `,
		params: [now],
	});

	// Mark orphaned 'running' and 'awaiting_approval' processes as 'killed'.
	const result = await db.queryRun({
		query: `
    UPDATE execution_processes
    SET status = 'killed',
        completed_at = $1,
        updated_at = $2
    WHERE status IN ('running', 'awaiting_approval')
  `,
		params: [now, now],
	});

	// Clean up stale approvals that were pending when server crashed
	await db.queryRun({
		query: `
    UPDATE approvals
    SET status = 'denied',
        reason = 'Server restarted',
        updated_at = $1
    WHERE status = 'pending'
  `,
		params: [now],
	});

	return result.rowCount;
}
