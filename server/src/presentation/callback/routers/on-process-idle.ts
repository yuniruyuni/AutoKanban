import { Session } from "../../../models/session";
import { Task } from "../../../models/task";
import { Workspace } from "../../../models/workspace";
import type { FullRepos } from "../../../repositories/common";
import type { Repos } from "../../../repositories";
import type { ILogger } from "../../../lib/logger/types";
import type { ProcessIdleInfo } from "../client";

export async function handleProcessIdle(
	repos: FullRepos<Repos>,
	logger: ILogger,
	info: ProcessIdleInfo,
): Promise<void> {
	const log = logger.child("OnProcessIdle");

	// Check for queued message
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

	// No queued message — move task to inreview
	try {
		const session = await repos.session.get(Session.ById(info.sessionId));
		if (!session) return;

		const workspace = await repos.workspace.get(
			Workspace.ById(session.workspaceId),
		);
		if (!workspace?.taskId) return;

		const task = await repos.task.get(Task.ById(workspace.taskId));
		if (!task || task.status !== "inprogress") return;

		await repos.task.upsert({
			...task,
			status: "inreview",
			updatedAt: new Date(),
		});
	} catch (error) {
		log.error("Failed to move task to In Review:", error);
	}
}
