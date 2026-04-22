// @specre 01KPNSJ3QW3FQPJ7535FCQAXY7
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

/**
 * Handle process idle: send queued message or move task to inreview.
 */
export const handleProcessIdle = (processId: string, sessionId: string) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			const workspace = session
				? await ctx.repos.workspace.get(Workspace.ById(session.workspaceId))
				: null;
			const task = workspace?.taskId
				? await ctx.repos.task.get(Task.ById(workspace.taskId))
				: null;

			return { task };
		},

		post: async (ctx, { task }) => {
			const queuedMessage = ctx.repos.messageQueue.consume(sessionId);
			if (queuedMessage) {
				const success = await ctx.repos.executor.sendMessage(
					processId,
					queuedMessage.prompt,
				);
				if (!success) {
					ctx.repos.messageQueue.queue(
						sessionId,
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
