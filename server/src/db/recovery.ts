import type { Database } from "bun:sqlite";

/**
 * Recovers orphaned processes after server restart.
 * Running/awaiting_approval processes no longer have OS processes
 * and must be marked as killed. Tasks are left in their current state
 * so users can resume execution from where it was interrupted.
 *
 * @param db - The database instance
 * @returns The number of processes that were recovered (marked as killed)
 */
export function recoverOrphanedProcesses(db: Database): number {
	const now = new Date().toISOString();

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
