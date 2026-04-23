// @specre 01KPNSJ3QDCVVJXS9QES8YWY99
import type { ILogger } from "../infra/logger/types";
import type { Project } from "../models/project";
import type { Repos } from "../repositories";
import type { ServiceRepos } from "../repositories/common";

/**
 * Run cleanup script if configured in auto-kanban.json before worktree removal.
 * Best-effort: failures are logged but do not block worktree removal.
 */
export async function runCleanupIfConfigured(
	repos: ServiceRepos<Repos>,
	logger: ILogger,
	worktreePath: string,
): Promise<void> {
	let config: { cleanup: string | null };
	try {
		config = await repos.workspaceConfig.load(worktreePath);
	} catch {
		// auto-kanban.json not readable or missing — skip
		return;
	}

	if (!config.cleanup) {
		return;
	}

	logger.info(`Running cleanup script: ${config.cleanup} in ${worktreePath}`);

	try {
		const result = await repos.scriptRunner.run({
			command: config.cleanup,
			workingDir: worktreePath,
		});
		if (result.exitCode !== 0) {
			logger.warn(
				`Cleanup script exited with code ${result.exitCode}: ${result.stderr}`,
			);
		} else {
			logger.info("Cleanup script completed successfully");
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`Cleanup script failed: ${message}`);
	}
}

/**
 * Clean up and remove worktrees for a list of workspace IDs.
 * Runs cleanup script before removal, then removes worktrees.
 * Best-effort: individual failures are logged but do not block others.
 *
 * Shared by delete-task, delete-project, and update-task post steps.
 */
export async function cleanupAndRemoveWorktrees(
	repos: ServiceRepos<Repos>,
	logger: ILogger,
	workspaceIds: string[],
	project: Project,
	opts?: { deleteBranch?: boolean },
): Promise<void> {
	for (const wsId of workspaceIds) {
		try {
			const worktreePath = repos.worktree.getWorktreePath(wsId, project.name);
			const exists = await repos.worktree.worktreeExists(wsId, project.name);
			if (exists) {
				await runCleanupIfConfigured(repos, logger, worktreePath);
			}
			await repos.worktree.removeAllWorktrees(
				wsId,
				[project],
				true,
				opts?.deleteBranch,
			);
		} catch (error) {
			logger.error(`Failed to remove worktrees for workspace ${wsId}:`, error);
		}
	}
}
