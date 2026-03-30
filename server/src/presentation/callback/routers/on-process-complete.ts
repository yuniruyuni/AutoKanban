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
	await completeExecutionProcess(info).run(ctx);

	if (info.status === "completed") {
		const queuedMessage = ctx.repos.messageQueue.consume(info.sessionId);
		if (queuedMessage) {
			await processQueuedFollowUp({
				sessionId: info.sessionId,
				prompt: queuedMessage.prompt,
			}).run(ctx);
			return;
		}
	}

	await moveTaskToInReview({ sessionId: info.sessionId }).run(ctx);
}
