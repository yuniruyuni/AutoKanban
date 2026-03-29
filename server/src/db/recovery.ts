import type { Database } from "bun:sqlite";

/**
 * Recovers orphaned processes after server restart.
 * Running/awaiting_approval processes no longer have OS processes
 * and must be marked as killed. Associated tasks are transitioned
 * to 'inreview' so users can see the task needs attention.
 *
 * @param db - The database instance
 * @returns The number of processes that were recovered (marked as killed)
 */
export async function recoverOrphanedProcesses(db: Database): Promise<number> {
	const now = new Date().toISOString();

	// Move tasks associated with orphaned processes to 'inreview'.
	// Task → inreview signals to the user that the agent stopped
	// and the task needs manual review or re-execution.
	db.run(
		`
    UPDATE tasks SET status = 'inreview', updated_at = ?
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
		[now],
	);

	// Mark orphaned 'running' and 'awaiting_approval' processes as 'killed'.
	// Both states require a live OS process which no longer exists after restart.
	const result = db.run(
		`
    UPDATE execution_processes
    SET status = 'killed',
        completed_at = ?,
        updated_at = ?
    WHERE status IN ('running', 'awaiting_approval')
  `,
		[now, now],
	);

	// Clean up stale approvals that were pending when server crashed
	db.run(
		`
    UPDATE approvals
    SET status = 'denied',
        reason = 'Server restarted',
        updated_at = ?
    WHERE status = 'pending'
  `,
		[now],
	);

	return result.changes;
}
