import { z } from "zod";
import { forkConversation } from "../../../usecases/execution/fork-conversation";
import { getConversationHistory } from "../../../usecases/execution/get-conversation-history";
import { getExecution } from "../../../usecases/execution/get-execution";
import { getLatestExecution } from "../../../usecases/execution/get-latest-execution";
import { getStructuredLogs } from "../../../usecases/execution/get-structured-logs";
import {
	cancelQueue,
	getQueueStatus,
	queueMessage,
} from "../../../usecases/execution/queue-message";
import {
	getPendingPermissions,
	respondToPermission,
} from "../../../usecases/execution/respond-to-permission";
import { getDraft, saveDraft } from "../../../usecases/execution/save-draft";
import { startExecution } from "../../../usecases/execution/start-execution";
import { stopExecution } from "../../../usecases/execution/stop-execution";
import { runWorkspaceScript } from "../../../usecases/workspace/run-workspace-script";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const executionRouter = router({
	start: publicProcedure
		.input(
			z.object({
				taskId: z.string().uuid(),
				prompt: z.string().optional(), // If not provided, uses task.description
				executor: z.string().optional(),
				variant: z.string().optional(), // Configuration variant (e.g., 'default', 'plan')
				workingDir: z.string().optional(), // If not provided, uses first repo worktree
				dangerouslySkipPermissions: z.boolean().optional(),
				model: z.string().optional(),
				repoIds: z.array(z.string().uuid()).optional(),
				targetBranch: z.string().optional(), // Target branch for the worktree
				targetBranches: z.record(z.string()).optional(), // Legacy: for multi-repo support
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { taskId, ...rest } = input;
			return handleResult(await startExecution(taskId, rest).run(ctx));
		}),

	stop: publicProcedure
		.input(z.object({ executionProcessId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await stopExecution(input.executionProcessId).run(ctx)),
		),

	get: publicProcedure
		.input(
			z.object({
				executionProcessId: z.string().uuid(),
				includeLogs: z.boolean().optional(),
			}),
		)
		.query(async ({ ctx, input }) =>
			handleResult(
				await getExecution(input.executionProcessId, input.includeLogs).run(
					ctx,
				),
			),
		),

	// Get the latest execution for a task (follows Task -> Workspace -> Session -> ExecutionProcess)
	getLatest: publicProcedure
		.input(
			z.object({
				taskId: z.string().uuid(),
				includeLogs: z.boolean().optional(),
			}),
		)
		.query(async ({ ctx, input }) =>
			handleResult(
				await getLatestExecution(input.taskId, input.includeLogs).run(ctx),
			),
		),

	// Send message: Unified endpoint for sending messages
	// - If agent is idle or not running, sends immediately
	// - If agent is busy, queues the message for later
	queueMessage: publicProcedure
		.input(
			z.object({
				sessionId: z.string().uuid(),
				prompt: z.string().min(1),
				executor: z.string().optional(),
				variant: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { sessionId, prompt, ...rest } = input;
			return handleResult(await queueMessage(sessionId, prompt, rest).run(ctx));
		}),

	// Get queue status for a session
	getQueueStatus: publicProcedure
		.input(z.object({ sessionId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getQueueStatus(input.sessionId).run(ctx)),
		),

	// Cancel queued message
	cancelQueue: publicProcedure
		.input(z.object({ sessionId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await cancelQueue(input.sessionId).run(ctx)),
		),

	// Get conversation history for a session
	getConversationHistory: publicProcedure
		.input(z.object({ sessionId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getConversationHistory(input.sessionId).run(ctx)),
		),

	// Get structured logs (parsed chat messages) for an execution process
	getStructuredLogs: publicProcedure
		.input(z.object({ executionProcessId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getStructuredLogs(input.executionProcessId).run(ctx)),
		),

	// Respond to a permission request (approve or deny)
	respondToPermission: publicProcedure
		.input(
			z.object({
				sessionId: z.string().uuid(),
				requestId: z.string(),
				approved: z.boolean(),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await respondToPermission(
					input.sessionId,
					input.requestId,
					input.approved,
					input.reason,
				).run(ctx),
			),
		),

	// Get pending permission requests for a session
	getPendingPermissions: publicProcedure
		.input(z.object({ sessionId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getPendingPermissions(input).run(ctx)),
		),

	// Fork conversation at a specific message point
	forkConversation: publicProcedure
		.input(
			z.object({
				sessionId: z.string().uuid(),
				messageUuid: z.string(),
				newPrompt: z.string().min(1),
				executor: z.string().optional(),
				variant: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { sessionId, messageUuid, newPrompt, ...rest } = input;
			return handleResult(
				await forkConversation(sessionId, messageUuid, newPrompt, rest).run(
					ctx,
				),
			);
		}),

	// Save draft follow-up input
	saveDraft: publicProcedure
		.input(z.object({ sessionId: z.string().uuid(), text: z.string() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await saveDraft(input.sessionId, input.text).run(ctx)),
		),

	// Get saved draft
	getDraft: publicProcedure
		.input(z.object({ sessionId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getDraft(input.sessionId).run(ctx)),
		),

	runPrepare: publicProcedure
		.input(z.object({ taskId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await runWorkspaceScript(input.taskId, "prepare").run(ctx)),
		),

	runCleanup: publicProcedure
		.input(z.object({ taskId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await runWorkspaceScript(input.taskId, "cleanup").run(ctx)),
		),

	// SSE log streaming endpoint will be handled separately in Hono
});
