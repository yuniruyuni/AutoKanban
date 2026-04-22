import type { Context } from "../../../usecases/context";
import {
	completeExecutionProcess,
	moveTaskToInReview,
	processQueuedFollowUp,
} from "../../../usecases/execution/on-process-complete";
import type { ProcessCompletionInfo } from "../client";

export async function handleProcessComplete(
	ctx: Context,
	info: ProcessCompletionInfo,
): Promise<void> {
	await completeExecutionProcess(
		info.processId,
		info.sessionId,
		info.processType,
		info.status,
		info.exitCode,
	).run(ctx);

	// Only codingagent processes trigger follow-up and task status changes
	if (info.processType !== "codingagent") return;

	const queuedMessage = ctx.repos.messageQueue.consume(info.sessionId);
	if (queuedMessage) {
		await processQueuedFollowUp(info.sessionId, queuedMessage.prompt).run(ctx);
		return;
	}

	await moveTaskToInReview(info.sessionId).run(ctx);
}
