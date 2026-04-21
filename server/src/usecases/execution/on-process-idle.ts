// @specre 01KPNSJ3QW3FQPJ7535FCQAXY7
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface ProcessIdleInput {
	processId: string;
	sessionId: string;
}

/**
 * Handle process idle: send queued message or move task to inreview.
 */
export const handleProcessIdle = (input: ProcessIdleInput) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			const workspace = session
				? await ctx.repos.workspace.get(Workspace.ById(session.workspaceId))
				: null;
			const task = workspace?.taskId
				? await ctx.repos.task.get(Task.ById(workspace.taskId))
				: null;

			return { task };
		},

		post: async (ctx, { task }) => {
			const queuedMessage = ctx.repos.messageQueue.consume(input.sessionId);
			if (queuedMessage) {
				const success = await ctx.repos.executor.sendMessage(
					input.processId,
					queuedMessage.prompt,
				);
				if (!success) {
					ctx.repos.messageQueue.queue(
						input.sessionId,
						queuedMessage.prompt,
						queuedMessage.executor,
						queuedMessage.variant,
					);
				}
				return { updatedTask: null };
			}

			// Turn is complete and no follow-up queued — move task to inreview
			const updatedTask = task ? Task.toInReview(task) : null;

			return { updatedTask: updatedTask ?? null };
		},

		finish: async (ctx, { updatedTask }) => {
			// Persist task status change in a new DB transaction
			if (updatedTask) {
				await ctx.repos.task.upsert(updatedTask);
			}
			return {};
		},
	});
