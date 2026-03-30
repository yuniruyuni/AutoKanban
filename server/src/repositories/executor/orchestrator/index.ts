import { randomUUID } from "node:crypto";
import type { ICodingAgentDriver } from "./coding-agent-driver";
import type { DriverApprovalRequest } from "./driver-approval-request";
import type { DriverProcess } from "./driver-process";
import type { Full } from "../../common";
import type { ServiceCtx } from "../../common";
import type { ILogger } from "../../../lib/logger/types";
import type {
	CodingAgentTurnRepository,
	ExecutionProcessLogsRepository,
	ExecutorProcessInfo,
	ExecutorRepository as ExecutorRepositoryDef,
	ExecutorStartOptions,
	ExecutorStartProtocolOptions,
} from "../..";
import type { ExecutionProcess } from "../../../models/execution-process";

export interface RunningProcess extends ExecutorProcessInfo {
	process: DriverProcess;
	driver: ICodingAgentDriver;
	/** Options used to start this process, for retry without resume on failure */
	startOptions?: ExecutorStartProtocolOptions;
}

export interface ProcessCompletionInfo {
	processId: string;
	sessionId: string;
	status: ExecutionProcess.Status;
	exitCode: number | null;
}

export type ProcessCompletionCallback = (
	info: ProcessCompletionInfo,
) => void | Promise<void>;

export interface ProcessIdleInfo {
	processId: string;
	sessionId: string;
}

export type ProcessIdleCallback = (
	info: ProcessIdleInfo,
) => void | Promise<void>;

export type ApprovalRequestCallback = (
	processId: string,
	request: DriverApprovalRequest,
) => void | Promise<void>;

/**
 * Generic orchestrator for coding agent process lifecycle.
 * Delegates protocol-specific logic to ICodingAgentDriver implementations.
 * Handles process spawning, stopping, and completion detection.
 *
 * This repository is pure process I/O — no database operations.
 * DB operations triggered by process events are handled by lifecycle handlers
 * in the usecases layer.
 */
export class ExecutorRepository implements ExecutorRepositoryDef {
	private runningProcesses = new Map<string, RunningProcess>();
	private completionCallbacks: ProcessCompletionCallback[] = [];
	private idleCallbacks: ProcessIdleCallback[] = [];
	private approvalRequestCallbacks: ApprovalRequestCallback[] = [];
	private logger: ILogger;

	constructor(
		private drivers: Map<string, ICodingAgentDriver>,
		logger: ILogger,
	) {
		this.logger = logger.child("ExecutorRepository");
	}

	onProcessComplete(callback: ProcessCompletionCallback): void {
		this.completionCallbacks.push(callback);
	}

	onIdle(callback: ProcessIdleCallback): void {
		this.idleCallbacks.push(callback);
	}

	onApprovalRequest(callback: ApprovalRequestCallback): void {
		this.approvalRequestCallbacks.push(callback);
	}

	async start(
		_ctx: ServiceCtx,
		options: ExecutorStartOptions,
	): Promise<RunningProcess> {
		const id = randomUUID();
		const now = new Date();

		const driver = this.getDriver(options.executor);
		const process = driver.spawn({
			workingDir: options.workingDir,
			model: options.model,
		});

		const runningProcess: RunningProcess = {
			id,
			sessionId: options.sessionId,
			runReason: options.runReason,
			process,
			driver,
			startedAt: now,
		};

		this.runningProcesses.set(id, runningProcess);
		this.setupCompletionHandler(runningProcess);

		return runningProcess;
	}

	async startProtocol(
		_ctx: ServiceCtx,
		options: ExecutorStartProtocolOptions,
	): Promise<RunningProcess> {
		const id = randomUUID();
		const now = new Date();

		const driver = this.getDriver(options.executor);

		const process = driver.spawn({
			workingDir: options.workingDir,
			model: options.model,
			permissionMode: options.permissionMode,
			resumeToken: options.resumeSessionId,
			messageToken: options.resumeMessageId,
		});

		const runningProcess: RunningProcess = {
			id,
			sessionId: options.sessionId,
			runReason: options.runReason,
			process,
			driver,
			startedAt: now,
			startOptions: options.resumeSessionId ? options : undefined,
		};

		this.runningProcesses.set(id, runningProcess);
		this.setupCompletionHandler(runningProcess);

		await driver.initialize(
			process,
			id,
			{
				onIdle: (pid) => this.notifyIdleCallbacks(pid),
				onApprovalRequest: (pid, req) =>
					this.notifyApprovalRequestCallbacks(pid, req),
				onSessionInfo: () => {},
				onSummary: () => {},
			},
			options.logsRepo!,
			options.codingAgentTurnRepo,
		);

		if (
			options.interruptedTools &&
			options.interruptedTools.length > 0 &&
			driver.sendInterruptedToolResults
		) {
			await driver.sendInterruptedToolResults(
				process,
				options.interruptedTools,
			);
		}

		await driver.sendMessage(process, options.prompt);

		return runningProcess;
	}

	async stop(_ctx: ServiceCtx, processId: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		runningProcess.driver.interrupt(runningProcess.process);
		return true;
	}

	async kill(_ctx: ServiceCtx, processId: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		runningProcess.driver.kill(runningProcess.process);
		this.runningProcesses.delete(processId);
		return true;
	}

	async sendMessage(
		_ctx: ServiceCtx,
		processId: string,
		prompt: string,
	): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		try {
			await runningProcess.driver.sendMessage(runningProcess.process, prompt);
			return true;
		} catch (error) {
			this.logger.error("Failed to send message:", error);
			return false;
		}
	}

	async sendPermissionResponse(
		_ctx: ServiceCtx,
		processId: string,
		requestId: string,
		approved: boolean,
		requestSubtype?: string,
		reason?: string,
		_updatedPermissions?: Array<{
			type: string;
			mode?: string;
			destination?: string;
		}>,
		toolInput?: Record<string, unknown>,
	): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		const request: DriverApprovalRequest = {
			toolName: "unknown",
			toolCallId: requestId,
			toolInput: toolInput ?? {},
			protocolContext: {
				requestId,
				requestSubtype: requestSubtype ?? "canUseTool",
				toolInput: toolInput ?? {},
			},
		};

		try {
			await runningProcess.driver.respondToApproval(
				runningProcess.process,
				request,
				approved,
				reason,
			);
			return true;
		} catch (error) {
			this.logger.error("Failed to send permission response:", error);
			return false;
		}
	}

	async startProtocolAndWait(
		_ctx: ServiceCtx,
		options: ExecutorStartProtocolOptions,
	): Promise<{ exitCode: number }> {
		const rp = await this.startProtocol(_ctx, options);
		return rp.driver.wait(rp.process);
	}

	/**
	 * Runs a one-shot prompt with structured output via the specified driver.
	 * Uses --json-schema for guaranteed JSON format.
	 */
	async runStructured(
		_ctx: ServiceCtx,
		executorName: string | undefined,
		options: {
			workingDir: string;
			prompt: string;
			schema: Record<string, unknown>;
			resumeSessionId?: string;
			model?: string;
		},
	): Promise<unknown> {
		const driver = this.getDriver(executorName);
		if (!driver.runStructured) return null;
		return driver.runStructured(options);
	}

	get(_ctx: ServiceCtx, processId: string): RunningProcess | undefined {
		return this.runningProcesses.get(processId);
	}

	getBySession(_ctx: ServiceCtx, sessionId: string): RunningProcess[] {
		return Array.from(this.runningProcesses.values()).filter(
			(p) => p.sessionId === sessionId,
		);
	}

	getStdout(
		_ctx: ServiceCtx,
		processId: string,
	): ReadableStream<Uint8Array> | null {
		const process = this.runningProcesses.get(processId);
		return process?.process.stdout ?? null;
	}

	getStderr(
		_ctx: ServiceCtx,
		processId: string,
	): ReadableStream<Uint8Array> | null {
		const process = this.runningProcesses.get(processId);
		return process?.process.stderr ?? null;
	}

	// ============================================
	// Idle, Approval & Completion Handling
	// ============================================

	private notifyIdleCallbacks(processId: string): void {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) return;

		const idleInfo: ProcessIdleInfo = {
			processId,
			sessionId: runningProcess.sessionId,
		};

		for (const callback of this.idleCallbacks) {
			try {
				callback(idleInfo);
			} catch (err) {
				this.logger.error("Error in idle callback:", err);
			}
		}
	}

	private notifyApprovalRequestCallbacks(
		processId: string,
		request: DriverApprovalRequest,
	): void {
		for (const callback of this.approvalRequestCallbacks) {
			try {
				callback(processId, request);
			} catch (err) {
				this.logger.error("Error in approval request callback:", err);
			}
		}
	}

	private setupCompletionHandler(runningProcess: RunningProcess): void {
		runningProcess.driver.wait(runningProcess.process).then(async (result) => {
			const status: ExecutionProcess.Status = result.killed
				? "killed"
				: result.exitCode === 0
					? "completed"
					: "failed";

			this.runningProcesses.delete(runningProcess.id);

			const completionInfo: ProcessCompletionInfo = {
				processId: runningProcess.id,
				sessionId: runningProcess.sessionId,
				status,
				exitCode: result.exitCode,
			};

			const results = await Promise.allSettled(
				this.completionCallbacks.map((callback) => callback(completionInfo)),
			);
			for (const result of results) {
				if (result.status === "rejected") {
					this.logger.error(
						"Error in process completion callback:",
						result.reason,
					);
				}
			}
		});
	}

	// ============================================
	// Driver Lookup
	// ============================================

	private getDriver(executorName?: string): ICodingAgentDriver {
		const name = executorName ?? "claude-code";
		const driver = this.drivers.get(name);
		if (!driver) {
			throw new Error(
				`Unknown executor driver: "${name}". Available: ${Array.from(this.drivers.keys()).join(", ")}`,
			);
		}
		return driver;
	}
}
