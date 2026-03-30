import type { FullRepos } from "../../repositories/common";
import type { Repos } from "../../repositories";
import type { ILogger } from "../../lib/logger/types";
import type { DriverApprovalRequest } from "../../repositories/executor/orchestrator/driver-approval-request";
import type {
	CallbackClient,
	ProcessCompletionInfo,
	ProcessIdleInfo,
} from "./client";
import { handleApprovalRequest } from "./routers/on-approval-request";
import { handleProcessComplete } from "./routers/on-process-complete";
import { handleProcessIdle } from "./routers/on-process-idle";

/**
 * CallbackClient implementation.
 * Delegates to presentation/callback/routers which invoke usecases.
 * Must be initialized with bound repos after Context construction.
 */
export class CallbackClientImpl implements CallbackClient {
	private repos: FullRepos<Repos> | null = null;
	private logger: ILogger | null = null;

	initialize(repos: FullRepos<Repos>, logger: ILogger): void {
		this.repos = repos;
		this.logger = logger;
	}

	async onProcessComplete(info: ProcessCompletionInfo): Promise<void> {
		if (!this.repos || !this.logger)
			throw new Error("CallbackClient not initialized");
		await handleProcessComplete(this.repos, this.logger, info);
	}

	async onProcessIdle(info: ProcessIdleInfo): Promise<void> {
		if (!this.repos || !this.logger)
			throw new Error("CallbackClient not initialized");
		await handleProcessIdle(this.repos, this.logger, info);
	}

	async onApprovalRequest(
		processId: string,
		request: DriverApprovalRequest,
	): Promise<void> {
		if (!this.repos || !this.logger)
			throw new Error("CallbackClient not initialized");
		await handleApprovalRequest(this.repos, this.logger, processId, request);
	}
}
