import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import type { FullRepos } from "../../repositories/common";
import type { ILogger } from "../../lib/logger/types";
import type { Repos } from "../../repositories";
import type {
	ExecutorRepository as ExecutorRepositoryImpl,
	ProcessCompletionInfo,
	ProcessIdleInfo,
} from "../../repositories/executor";

/**
 * Sets up automatic processing of queued messages when processes complete.
 * Receives the concrete ExecutorRepository for event subscription (onIdle/onProcessComplete)
 * and FullRepos for data access.
 */
export function setupQueueProcessor(
	executor: ExecutorRepositoryImpl,
	repos: FullRepos<Repos>,
	logger: ILogger,
): void {
	const log = logger.child("QueueProcessor");

	const moveTaskToInReview = async (sessionId: string) => {
		try {
			const session = await repos.session.get(Session.ById(sessionId));
			if (!session) return;

			const workspace = await repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace?.taskId) return;

			const task = await repos.task.get(Task.ById(workspace.taskId));
			if (!task) return;

			if (task.status !== "inprogress") return;

			await repos.task.upsert({
				...task,
				status: "inreview",
				updatedAt: new Date(),
			});
		} catch (error) {
			log.error("Failed to move task to In Review:", error);
		}
	};

	executor.onIdle(async (info: ProcessIdleInfo) => {
		const queuedMessage = repos.messageQueue.consume(info.sessionId);
		if (queuedMessage) {
			try {
				const success = await repos.executor.sendMessage(
					info.processId,
					queuedMessage.prompt,
				);
				if (!success) {
					repos.messageQueue.queue(
						info.sessionId,
						queuedMessage.prompt,
						queuedMessage.executor,
						queuedMessage.variant,
					);
				}
			} catch (error) {
				log.error("Error sending queued message:", error);
				repos.messageQueue.queue(
					info.sessionId,
					queuedMessage.prompt,
					queuedMessage.executor,
					queuedMessage.variant,
				);
			}
			return;
		}

		await moveTaskToInReview(info.sessionId);
	});

	executor.onProcessComplete(async (info: ProcessCompletionInfo) => {
		if (info.status !== "completed") {
			await moveTaskToInReview(info.sessionId);
			return;
		}

		const queuedMessage = repos.messageQueue.consume(info.sessionId);
		if (!queuedMessage) {
			await moveTaskToInReview(info.sessionId);
			return;
		}

		try {
			const session = await repos.session.get(Session.ById(info.sessionId));
			if (!session) return;

			const workspace = await repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) return;

			const workspaceReposPage = await repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const wsRepo = workspaceReposPage.items[0];
			const project = wsRepo
				? await repos.project.get(Project.ById(wsRepo.projectId))
				: null;

			let workingDir: string;
			if (workspace.worktreePath) {
				workingDir = project
					? `${workspace.worktreePath}/${project.name}`
					: workspace.worktreePath;
			} else if (project) {
				workingDir = project.repoPath;
			} else {
				return;
			}

			await repos.executor.start({
				sessionId: info.sessionId,
				runReason: "codingagent",
				workingDir,
				prompt: queuedMessage.prompt,
			});
		} catch (error) {
			log.error("Failed to process queued message:", error);
		}
	});
}
