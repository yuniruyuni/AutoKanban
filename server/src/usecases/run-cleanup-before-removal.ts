// @specre 01KPNSJ3QDCVVJXS9QES8YWY99
import type { ILogger } from "../infra/logger/types";
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
