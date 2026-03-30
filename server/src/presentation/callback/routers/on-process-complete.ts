import { ExecutionProcess } from "../../../models/execution-process";
import { Project } from "../../../models/project";
import { Session } from "../../../models/session";
import { Task } from "../../../models/task";
import { Workspace } from "../../../models/workspace";
import { WorkspaceRepo } from "../../../models/workspace-repo";
import type { FullRepos } from "../../../repositories/common";
import type { Repos } from "../../../repositories";
import type { ILogger } from "../../../lib/logger/types";
import type { ProcessCompletionInfo } from "../client";

export async function handleProcessComplete(
	repos: FullRepos<Repos>,
	logger: ILogger,
	info: ProcessCompletionInfo,
): Promise<void> {
	const log = logger.child("OnProcessComplete");

	// Update ExecutionProcess status
	try {
		const existing = await repos.executionProcess.get(
			ExecutionProcess.ById(info.processId),
		);
		if (existing) {
			const now = new Date();
			await repos.executionProcess.upsert({
				...existing,
				status: info.status,
				exitCode: info.exitCode,
				completedAt: now,
				updatedAt: now,
			});
		}
	} catch (error) {
		log.error("Failed to update execution process on completion:", error);
	}

	// Close log store
	repos.logStoreManager.close(info.processId);

	// Check queue for follow-up message
	if (info.status === "completed") {
		const queuedMessage = repos.messageQueue.consume(info.sessionId);
		if (queuedMessage) {
			try {
				const session = await repos.session.get(
					Session.ById(info.sessionId),
				);
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

				const rp = await repos.executor.start({
					sessionId: info.sessionId,
					runReason: "codingagent",
					workingDir,
					prompt: queuedMessage.prompt,
				});

				// Create ExecutionProcess DB record
				const now = new Date();
				await repos.executionProcess.upsert({
					id: rp.id,
					sessionId: info.sessionId,
					runReason: "codingagent",
					status: "running",
					exitCode: null,
					startedAt: now,
					completedAt: null,
					createdAt: now,
					updatedAt: now,
				});
			} catch (error) {
				log.error("Failed to process queued message:", error);
			}
			return;
		}
	}

	// No queued message or non-completed status — move task to inreview
	await moveTaskToInReview(repos, info.sessionId, log);
}

async function moveTaskToInReview(
	repos: FullRepos<Repos>,
	sessionId: string,
	log: ILogger,
): Promise<void> {
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
}
