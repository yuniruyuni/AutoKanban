import type { Context } from "../context";

/**
 * Recovers orphaned processes after server restart.
 * Running/awaiting_approval processes no longer have OS processes
 * and must be marked as killed. Associated tasks are transitioned
 * to 'inreview' so users can see the task needs attention.
 *
 * Uses db.transaction directly because this requires bulk UPDATEs
 * across multiple tables that aren't covered by standard repository methods.
 */
export async function recoverOrphanedProcesses(ctx: Context): Promise<number> {
	return ctx.db.transaction(async (tx) => {
		const now = new Date().toISOString();

		// Move tasks associated with orphaned coding agent processes to 'inreview'.
		await tx.queryRun({
			query: `
      UPDATE tasks SET status = 'inreview', updated_at = $1
      WHERE status IN ('inprogress', 'inreview')
        AND id IN (
          SELECT w.task_id
          FROM coding_agent_processes cap
          JOIN sessions s ON cap.session_id = s.id
          JOIN workspaces w ON s.workspace_id = w.id
          WHERE cap.status IN ('running', 'awaiting_approval')
            AND w.task_id IS NOT NULL
        )
    `,
			params: [now],
		});

		// Mark orphaned coding agent processes as 'killed'.
		const caResult = await tx.queryRun({
			query: `
      UPDATE coding_agent_processes
      SET status = 'killed',
          completed_at = $1,
          updated_at = $2
      WHERE status IN ('running', 'awaiting_approval')
    `,
			params: [now, now],
		});

		// Mark orphaned dev server processes as 'killed'.
		await tx.queryRun({
			query: `
      UPDATE dev_server_processes
      SET status = 'killed',
          completed_at = $1,
          updated_at = $2
      WHERE status = 'running'
    `,
			params: [now, now],
		});

		// Mark orphaned workspace script processes as 'killed'.
		await tx.queryRun({
			query: `
      UPDATE workspace_script_processes
      SET status = 'killed',
          completed_at = $1,
          updated_at = $2
      WHERE status = 'running'
    `,
			params: [now, now],
		});

		// Clean up stale approvals that were pending when server crashed
		await tx.queryRun({
			query: `
      UPDATE approvals
      SET status = 'denied',
          reason = 'Server restarted',
          updated_at = $1
      WHERE status = 'pending'
    `,
			params: [now],
		});

		return caResult.rowCount;
	});
}
