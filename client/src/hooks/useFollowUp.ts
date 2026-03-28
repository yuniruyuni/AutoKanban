import { trpc } from "@/trpc";

export interface QueuedMessage {
	sessionId: string;
	prompt: string;
	executor?: string;
	variant?: string;
	queuedAt: string;
}

export interface QueueStatus {
	hasMessage: boolean;
	message?: QueuedMessage;
}

export interface SendResult {
	sentImmediately: boolean;
	executionProcessId?: string;
}

/**
 * Hook for sending follow-up messages to a session.
 *
 * The server handles all the logic:
 * - If the agent is idle or not running, the message is sent immediately
 * - If the agent is busy, the message is queued for later
 *
 * The client just sends messages and displays the queue status.
 */
export function useFollowUp(sessionId: string | null) {
	const utils = trpc.useUtils();

	const sendMutation = trpc.execution.queueMessage.useMutation({
		onSuccess: () => {
			utils.execution.getQueueStatus.invalidate();
		},
	});

	const cancelMutation = trpc.execution.cancelQueue.useMutation({
		onSuccess: () => {
			utils.execution.getQueueStatus.invalidate();
		},
	});

	const queueStatusQuery = trpc.execution.getQueueStatus.useQuery(
		{ sessionId: sessionId ?? "" },
		{
			enabled: !!sessionId,
			refetchInterval: 2000, // Poll every 2 seconds to detect changes
		},
	);

	/**
	 * Send a message to the session.
	 * The server decides whether to send immediately or queue.
	 */
	const send = async (
		prompt: string,
		options?: { executor?: string; variant?: string },
	): Promise<SendResult> => {
		if (!sessionId) {
			throw new Error("No session ID");
		}
		const result = await sendMutation.mutateAsync({
			sessionId,
			prompt,
			executor: options?.executor,
			variant: options?.variant,
		});
		return {
			sentImmediately: result.sentImmediately,
			executionProcessId: result.executionProcessId,
		};
	};

	/**
	 * Cancel the queued message.
	 */
	const cancel = async (): Promise<void> => {
		if (!sessionId) {
			throw new Error("No session ID");
		}
		await cancelMutation.mutateAsync({
			sessionId,
		});
	};

	// Extract queue status from query result
	const queueStatus: QueueStatus | undefined = queueStatusQuery.data?.status;

	return {
		// Actions
		send,
		cancel,

		// Status
		queuedMessage: queueStatus?.message,
		hasQueuedMessage: queueStatus?.hasMessage ?? false,

		// Loading states
		isSending: sendMutation.isPending,
		isCancelling: cancelMutation.isPending,
		isLoadingQueueStatus: queueStatusQuery.isLoading,

		// Errors
		sendError: sendMutation.error,
	};
}
