import type { Database } from "bun:sqlite";
import type { ILogStreamer } from "../../src/presentation/log-streamer";
import { ApprovalRepository } from "../../src/repositories/approval-repository";
import { CodingAgentTurnRepository } from "../../src/repositories/coding-agent-turn-repository";
import { ExecutionProcessLogsRepository } from "../../src/repositories/execution-process-logs-repository";
import { ExecutionProcessRepository } from "../../src/repositories/execution-process-repository";
import { ProjectRepository } from "../../src/repositories/project-repository";
import { SessionRepository } from "../../src/repositories/session-repository";
import { TaskRepository } from "../../src/repositories/task-repository";
import { WorkspaceRepoRepository } from "../../src/repositories/workspace-repo-repository";
import { WorkspaceRepository } from "../../src/repositories/workspace-repository";
import type { Context, Repos } from "../../src/types/context";
import { createMockLogger } from "./logger";

/**
 * Create a mock context for usecase unit tests.
 * Unset repo methods throw on access via Proxy to catch unexpected calls.
 */
export function createMockContext(repoOverrides: Partial<Repos> = {}): Context {
	const handler: ProxyHandler<Repos> = {
		get(_, prop: string | symbol) {
			if (typeof prop === "string" && prop in repoOverrides) {
				return (repoOverrides as Record<string, unknown>)[prop];
			}
			// Return a proxy that throws on any method call
			return new Proxy(
				{},
				{
					get(_, method: string) {
						return () => {
							throw new Error(
								`Unexpected repo call: repos.${String(prop)}.${method}()`,
							);
						};
					},
				},
			);
		},
	};

	return {
		now: new Date("2025-01-15T10:00:00.000Z"),
		logger: createMockLogger(),
		repos: new Proxy({} as Repos, handler),
		logStreamer: {} as ILogStreamer,
	};
}

/**
 * Create an integration context with real DB repositories.
 * External system repos (git, worktree, executor, etc.) are mocked.
 */
export function createIntegrationContext(db: Database): Context {
	return {
		now: new Date("2025-01-15T10:00:00.000Z"),
		logger: createMockLogger(),
		repos: {
			task: new TaskRepository(db),
			taskTemplate: {} as Repos["taskTemplate"],
			project: new ProjectRepository(db),
			workspace: new WorkspaceRepository(db),
			session: new SessionRepository(db),
			executionProcess: new ExecutionProcessRepository(db),
			executionProcessLogs: new ExecutionProcessLogsRepository(db),
			workspaceRepo: new WorkspaceRepoRepository(db),
			codingAgentTurn: new CodingAgentTurnRepository(db),
			approval: new ApprovalRepository(db),
			// External system repos - mock stubs
			tool: {} as Repos["tool"],
			variant: {} as Repos["variant"],
			git: {} as Repos["git"],
			worktree: {} as Repos["worktree"],
			executor: {} as Repos["executor"],
			messageQueue: {} as Repos["messageQueue"],
			agentConfig: {} as Repos["agentConfig"],
			draft: {} as Repos["draft"],
			permissionStore: {} as Repos["permissionStore"],
			approvalStore: {} as Repos["approvalStore"],
			logStoreManager: {} as Repos["logStoreManager"],
			devServer: {} as Repos["devServer"],
		},
		logStreamer: {} as ILogStreamer,
	};
}
