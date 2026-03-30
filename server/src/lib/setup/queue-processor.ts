import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import type {
	ExecutorRepository,
	ProcessCompletionInfo,
	ProcessIdleInfo,
} from "../../repositories/executor";
import type { MessageQueueRepository } from "../../repositories/message-queue/memory";
import { createServiceCtx, type Full } from "../../repositories/common";
import type { ILogger } from "../../types/logger";
import type {
	ProjectRepository,
	SessionRepository,
	TaskRepository,
	WorkspaceRepoRepository,
	WorkspaceRepository,
} from "../../repositories";

export interface QueueProcessorDependencies {
	executor: ExecutorRepository;
	messageQueue: MessageQueueRepository;
	sessionRepo: Full<SessionRepository>;
	workspaceRepo: Full<WorkspaceRepository>;
	workspaceRepoRepo: Full<WorkspaceRepoRepository>;
	projectRepo: Full<ProjectRepository>;
	taskRepo: Full<TaskRepository>;
	logger: ILogger;
}

/**
 * Sets up automatic processing of queued messages when processes complete.
 * When a process finishes, checks if there's a queued message for the session
 * and automatically starts a new execution with that message.
 * Also handles automatic task status transitions when Claude becomes idle.
 */
export function setupQueueProcessor(deps: QueueProcessorDependencies): void {
	const {
		executor,
		messageQueue,
		sessionRepo,
		workspaceRepo,
		workspaceRepoRepo,
		projectRepo,
		taskRepo,
		logger: parentLogger,
	} = deps;
	const logger = parentLogger.child("QueueProcessor");
	const svcCtx = createServiceCtx();

	// Helper to move a task associated with a session to In Review
	const moveTaskToInReview = async (sessionId: string) => {
		try {
			const session = await sessionRepo.get(Session.ById(sessionId));
			if (!session) return;

			const workspace = await workspaceRepo.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace?.taskId) return;

			const task = await taskRepo.get(Task.ById(workspace.taskId));
			if (!task) return;

			// Only move to In Review if currently In Progress
			if (task.status !== "inprogress") return;

			const now = new Date();
			await taskRepo.upsert({
				...task,
				status: "inreview",
				updatedAt: now,
			});
		} catch (error) {
			logger.error("Failed to move task to In Review:", error);
		}
	};

	// Handle idle events - send queued message or move task to In Review
	executor.onIdle(async (info: ProcessIdleInfo) => {
		// Check if there's a queued message for this session
		const queuedMessage = messageQueue.consume(svcCtx, info.sessionId);
		if (queuedMessage) {
			try {
				// Send the queued message to the idle process
				const success = await executor.sendMessage(
					svcCtx,
					info.processId,
					queuedMessage.prompt,
				);
				if (!success) {
					// Put the message back in the queue if sending failed
					messageQueue.queue(
						svcCtx,
						info.sessionId,
						queuedMessage.prompt,
						queuedMessage.executor,
						queuedMessage.variant,
					);
				}
			} catch (error) {
				logger.error("Error sending queued message:", error);
				// Put the message back in the queue on error
				messageQueue.queue(
					svcCtx,
					info.sessionId,
					queuedMessage.prompt,
					queuedMessage.executor,
					queuedMessage.variant,
				);
			}
			return;
		}

		// No queued message - move task to In Review
		await moveTaskToInReview(info.sessionId);
	});

	executor.onProcessComplete(async (info: ProcessCompletionInfo) => {
		// For failed/killed processes, move task to In Review
		if (info.status !== "completed") {
			await moveTaskToInReview(info.sessionId);
			return;
		}

		// Check if there's a queued message for this session
		const queuedMessage = messageQueue.consume(svcCtx, info.sessionId);
		if (!queuedMessage) {
			await moveTaskToInReview(info.sessionId);
			return;
		}

		try {
			// Get session and workspace info for the follow-up
			const session = await sessionRepo.get(Session.ById(info.sessionId));
			if (!session) return;

			const workspace = await workspaceRepo.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) return;

			// Determine working directory
			const workspaceReposPage = await workspaceRepoRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const workspaceRepo_ = workspaceReposPage.items[0];
			const project = workspaceRepo_
				? await projectRepo.get(Project.ById(workspaceRepo_.projectId))
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

			// Start the follow-up execution
			await executor.start(svcCtx, {
				sessionId: info.sessionId,
				runReason: "codingagent",
				workingDir,
				prompt: queuedMessage.prompt,
			});
		} catch (error) {
			logger.error("Failed to process queued message:", error);
		}
	});
}
