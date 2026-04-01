import { randomUUID } from "node:crypto";
import type { CallbackClient } from "../../../infra/callback/client";
import type { ILogger } from "../../../infra/logger/types";
import type { CodingAgentProcess } from "../../../models/coding-agent-process";
import type {
	ExecutorProcessInfo,
	ExecutorRepository as ExecutorRepositoryDef,
	ExecutorStartOptions,
	ExecutorStartProtocolOptions,
} from "../..";
import type { ServiceCtx } from "../../common";
import type { ICodingAgentDriver } from "./coding-agent-driver";
import type { DriverApprovalRequest } from "./driver-approval-request";
import type { DriverProcess } from "./driver-process";

export interface RunningProcess extends ExecutorProcessInfo {
	process: DriverProcess;
	driver: ICodingAgentDriver;
	startOptions?: ExecutorStartProtocolOptions;
	callback: CallbackClient;
}

/**
 * Generic orchestrator for coding agent process lifecycle.
 * Pure process I/O — no database operations.
 * Calls callbackClient for process events (completion, idle, approval).
 */
export class ExecutorRepository implements ExecutorRepositoryDef {
	private runningProcesses = new Map<string, RunningProcess>();
	private logger: ILogger;

	constructor(
		private drivers: Map<string, ICodingAgentDriver>,
		logger: ILogger,
		private callbackClient: CallbackClient,
	) {
		this.logger = logger.child("ExecutorRepository");
	}

	async start(
		_ctx: ServiceCtx,
		options: ExecutorStartOptions,
	): Promise<RunningProcess> {
		const id = options.id ?? randomUUID();
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
			callback: this.callbackClient,
		};

		this.runningProcesses.set(id, runningProcess);
		this.setupCompletionHandler(runningProcess);

		return runningProcess;
	}

	async startProtocol(
		_ctx: ServiceCtx,
		options: ExecutorStartProtocolOptions,
	): Promise<RunningProcess> {
		const id = options.id ?? randomUUID();
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
			callback: this.callbackClient,
		};

		this.runningProcesses.set(id, runningProcess);
		this.setupCompletionHandler(runningProcess);

		await driver.initialize(process, id, {
			onIdle: (pid) => this.handleIdle(pid),
			onApprovalRequest: (pid, req) => this.handleApprovalRequest(pid, req),
			onLogData: (pid, source, data) => this.handleLogData(pid, source, data),
			onSessionInfo: (pid, info) => this.handleSessionInfo(pid, info),
			onSummary: (pid, summary) => this.handleSummary(pid, summary),
		});

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

		const request = {
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

	spawnStructured(
		_ctx: ServiceCtx,
		executorName: string | undefined,
		options: {
			workingDir: string;
			prompt: string;
			schema: Record<string, unknown>;
			model?: string;
		},
	): {
		stdout: ReadableStream<Uint8Array>;
		stderr: ReadableStream<Uint8Array>;
		exited: Promise<number>;
	} | null {
		const driver = this.getDriver(executorName);
		if (!driver.spawnStructured) return null;
		return driver.spawnStructured(options);
	}

	async runStructured(
		_ctx: ServiceCtx,
		executorName: string | undefined,
		options: {
			workingDir: string;
			prompt: string;
			schema: Record<string, unknown>;
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
	// Internal event handlers → callback client
	// ============================================

	private handleIdle(processId: string): void {
		const rp = this.runningProcesses.get(processId);
		if (!rp) return;

		rp.callback
			.onProcessIdle({ processId, sessionId: rp.sessionId })
			.catch((err) => this.logger.error("Error in idle callback:", err));
	}

	private handleApprovalRequest(
		processId: string,
		request: DriverApprovalRequest,
	): void {
		const rp = this.runningProcesses.get(processId);
		if (!rp) return;

		rp.callback
			.onApprovalRequest(processId, request)
			.catch((err) =>
				this.logger.error("Error in approval request callback:", err),
			);
	}

	private handleLogData(
		processId: string,
		source: "stdout" | "stderr",
		data: string,
	): void {
		const rp = this.runningProcesses.get(processId);
		if (!rp) return;

		rp.callback
			.onLogData({
				processId,
				sessionId: rp.sessionId,
				source,
				data,
			})
			.catch((err) => this.logger.error("Error in log data callback:", err));
	}

	private handleSessionInfo(
		processId: string,
		info: { resumeToken: string | null; messageToken: string | null },
	): void {
		const rp = this.runningProcesses.get(processId);
		if (!rp) return;

		rp.callback
			.onSessionInfo({
				processId,
				sessionId: rp.sessionId,
				agentSessionId: info.resumeToken,
				agentMessageId: info.messageToken,
			})
			.catch((err) =>
				this.logger.error("Error in session info callback:", err),
			);
	}

	private handleSummary(processId: string, summary: string): void {
		const rp = this.runningProcesses.get(processId);
		if (!rp) return;

		rp.callback
			.onSummary({ processId, sessionId: rp.sessionId, summary })
			.catch((err) => this.logger.error("Error in summary callback:", err));
	}

	private setupCompletionHandler(runningProcess: RunningProcess): void {
		runningProcess.driver
			.wait(runningProcess.process)
			.then(async (result) => {
				const status: CodingAgentProcess.Status = result.killed
					? "killed"
					: result.exitCode === 0
						? "completed"
						: "failed";

				this.runningProcesses.delete(runningProcess.id);

				await runningProcess.callback.onProcessComplete({
					processId: runningProcess.id,
					sessionId: runningProcess.sessionId,
					processType: "codingagent",
					status,
					exitCode: result.exitCode,
				});
			})
			.catch((err) => this.logger.error("Error in completion handler:", err));
	}

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
