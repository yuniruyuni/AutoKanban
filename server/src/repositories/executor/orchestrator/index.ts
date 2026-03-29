import { randomUUID } from "node:crypto";
import {
	buildContextFromLogs,
	buildContextRestoredPrompt,
} from "../../../lib/context-builder";
import { Approval } from "../../../models/approval";
import { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { ExecutionProcess } from "../../../models/execution-process";
import { Session } from "../../../models/session";
import { Task } from "../../../models/task";
import { Workspace } from "../../../models/workspace";
import type {
	DriverApprovalRequest,
	DriverProcess,
	ICodingAgentDriver,
} from "../../../types/coding-agent-driver";
import type { ILogger } from "../../../types/logger";
import type {
	ExecutorProcessInfo,
	ExecutorStartOptions,
	ExecutorStartProtocolOptions,
	IApprovalRepository,
	IApprovalStore,
	ICodingAgentTurnRepository,
	IExecutionProcessLogsRepository,
	IExecutionProcessRepository,
	IExecutorRepository,
	ISessionRepository,
	ITaskRepository,
	IWorkspaceRepository,
} from "../../../types/repository";
import { LogCollector } from "../../log-collector";
import { logStoreManager } from "../../log-store";

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

export type ProcessCompletionCallback = (info: ProcessCompletionInfo) => void;

export interface ProcessIdleInfo {
	processId: string;
	sessionId: string;
}

export type ProcessIdleCallback = (info: ProcessIdleInfo) => void;

/**
 * Generic orchestrator for coding agent process lifecycle.
 * Delegates protocol-specific logic to ICodingAgentDriver implementations.
 * Handles process spawning, stopping, approval flow, and completion.
 */
export class ExecutorRepository implements IExecutorRepository {
	private runningProcesses = new Map<string, RunningProcess>();
	private completionCallbacks: ProcessCompletionCallback[] = [];
	private idleCallbacks: ProcessIdleCallback[] = [];
	private logCollector: LogCollector;
	private logger: ILogger;

	private approvalRepo?: IApprovalRepository;
	private approvalStoreRef?: IApprovalStore;
	private taskRepo?: ITaskRepository;
	private sessionRepo?: ISessionRepository;
	private workspaceRepo?: IWorkspaceRepository;

	constructor(
		private executionProcessRepo: IExecutionProcessRepository,
		private codingAgentTurnRepo: ICodingAgentTurnRepository | undefined,
		private drivers: Map<string, ICodingAgentDriver>,
		private executionProcessLogsRepo: IExecutionProcessLogsRepository,
		logger: ILogger,
	) {
		this.logger = logger.child("ExecutorRepository");
		this.logCollector = new LogCollector(
			executionProcessLogsRepo,
			logger.child("LogCollector"),
		);
	}

	/**
	 * Sets the approval-related repos for approval handling.
	 * Called after construction to avoid circular dependencies.
	 */
	setApprovalDeps(deps: {
		approvalRepo: IApprovalRepository;
		approvalStore: IApprovalStore;
		taskRepo: ITaskRepository;
		sessionRepo: ISessionRepository;
		workspaceRepo: IWorkspaceRepository;
	}): void {
		this.approvalRepo = deps.approvalRepo;
		this.approvalStoreRef = deps.approvalStore;
		this.taskRepo = deps.taskRepo;
		this.sessionRepo = deps.sessionRepo;
		this.workspaceRepo = deps.workspaceRepo;
	}

	onProcessComplete(callback: ProcessCompletionCallback): void {
		this.completionCallbacks.push(callback);
	}

	onIdle(callback: ProcessIdleCallback): void {
		this.idleCallbacks.push(callback);
	}

	async start(options: ExecutorStartOptions): Promise<RunningProcess> {
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

		await this.executionProcessRepo.upsert({
			id,
			sessionId: options.sessionId,
			runReason: options.runReason,
			status: "running",
			exitCode: null,
			startedAt: now,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
		});

		this.setupCompletionHandler(runningProcess);
		this.logCollector.collect(id, process.stdout, process.stderr);

		return runningProcess;
	}

	async startProtocol(
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

		await this.executionProcessRepo.upsert({
			id,
			sessionId: options.sessionId,
			runReason: options.runReason,
			status: "running",
			exitCode: null,
			startedAt: now,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
		});

		if (options.runReason === "codingagent" && this.codingAgentTurnRepo) {
			const turn = CodingAgentTurn.create({
				executionProcessId: id,
				prompt: options.prompt,
			});
			await this.codingAgentTurnRepo.upsert(turn);
		}

		this.setupCompletionHandler(runningProcess);

		await driver.initialize(
			process,
			id,
			{
				onIdle: (pid) => this.notifyIdleCallbacks(pid),
				onApprovalRequest: (pid, req) => this.handleApprovalRequest(pid, req),
				onSessionInfo: () => {},
				onSummary: () => {},
			},
			this.executionProcessLogsRepo,
			this.codingAgentTurnRepo,
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

	async stop(processId: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		runningProcess.driver.interrupt(runningProcess.process);
		return true;
	}

	async kill(processId: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		runningProcess.driver.kill(runningProcess.process);

		const now = new Date();
		const existing = await this.executionProcessRepo.get(
			ExecutionProcess.ById(processId),
		);

		if (existing) {
			await this.executionProcessRepo.upsert({
				...existing,
				status: "killed",
				completedAt: now,
				updatedAt: now,
			});
		}

		this.runningProcesses.delete(processId);
		return true;
	}

	async sendMessage(processId: string, prompt: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		try {
			await runningProcess.driver.sendMessage(runningProcess.process, prompt);

			const userMessage = {
				type: "user",
				message: {
					role: "user",
					content: prompt,
				},
			};
			const timestamp = new Date().toISOString();
			const logEntry = `[${timestamp}] [stdout] ${JSON.stringify(userMessage)}\n`;
			await this.executionProcessLogsRepo.appendLogs(processId, logEntry);

			return true;
		} catch (error) {
			this.logger.error("Failed to send message:", error);
			return false;
		}
	}

	async sendPermissionResponse(
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
		options: ExecutorStartProtocolOptions,
	): Promise<{ exitCode: number }> {
		const rp = await this.startProtocol(options);
		return rp.driver.wait(rp.process);
	}

	/**
	 * Runs a one-shot prompt with structured output via the specified driver.
	 * Uses --json-schema for guaranteed JSON format.
	 */
	async runStructured<T>(
		executorName: string | undefined,
		options: {
			workingDir: string;
			prompt: string;
			schema: Record<string, unknown>;
			resumeSessionId?: string;
			model?: string;
		},
	): Promise<T | null> {
		const driver = this.getDriver(executorName);
		if (!driver.runStructured) return null;
		return driver.runStructured<T>(options);
	}

	get(processId: string): RunningProcess | undefined {
		return this.runningProcesses.get(processId);
	}

	getBySession(sessionId: string): RunningProcess[] {
		return Array.from(this.runningProcesses.values()).filter(
			(p) => p.sessionId === sessionId,
		);
	}

	getStdout(processId: string): ReadableStream<Uint8Array> | null {
		const process = this.runningProcesses.get(processId);
		return process?.process.stdout ?? null;
	}

	getStderr(processId: string): ReadableStream<Uint8Array> | null {
		const process = this.runningProcesses.get(processId);
		return process?.process.stderr ?? null;
	}

	// ============================================
	// Approval Handling (generic)
	// ============================================

	private async handleApprovalRequest(
		processId: string,
		request: DriverApprovalRequest,
	): Promise<void> {
		if (!this.approvalRepo || !this.approvalStoreRef) {
			this.logger.error(
				"Approval repos not configured, falling back to auto-approve",
			);
			const rp = this.runningProcesses.get(processId);
			if (rp) {
				await rp.driver.respondToApproval(rp.process, request, true);
			}
			return;
		}

		const approval = Approval.create({
			executionProcessId: processId,
			toolName: request.toolName,
			toolCallId: request.toolCallId,
		});

		const execProcess = await this.executionProcessRepo.get(
			ExecutionProcess.ById(processId),
		);
		if (execProcess && execProcess.status === "running") {
			await this.executionProcessRepo.upsert({
				...execProcess,
				status: "awaiting_approval",
				updatedAt: new Date(),
			});
		}

		const taskId = await this.findTaskIdForProcess(processId);
		if (taskId && this.taskRepo) {
			const task = await this.taskRepo.get(Task.ById(taskId));
			if (task && task.status === "inprogress") {
				await this.taskRepo.upsert({
					...task,
					status: "inreview",
					updatedAt: new Date(),
				});
			}
		}

		try {
			const response = await this.approvalStoreRef.createAndWait(
				approval,
				this.approvalRepo,
			);

			const approved = response.status === "approved";

			const rp = this.runningProcesses.get(processId);
			if (rp) {
				await rp.driver.respondToApproval(
					rp.process,
					request,
					approved,
					response.reason ?? undefined,
				);
			}

			const currentProcess = await this.executionProcessRepo.get(
				ExecutionProcess.ById(processId),
			);
			if (currentProcess && currentProcess.status === "awaiting_approval") {
				await this.executionProcessRepo.upsert({
					...currentProcess,
					status: "running",
					updatedAt: new Date(),
				});
			}

			if (taskId && this.taskRepo) {
				const task = await this.taskRepo.get(Task.ById(taskId));
				if (task && task.status === "inreview") {
					await this.taskRepo.upsert({
						...task,
						status: "inprogress",
						updatedAt: new Date(),
					});
				}
			}
		} catch (error) {
			this.logger.error("Error handling approval request:", error);
		}
	}

	private async findTaskIdForProcess(
		processId: string,
	): Promise<string | null> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess || !this.sessionRepo || !this.workspaceRepo)
			return null;

		try {
			const session = await this.sessionRepo.get(
				Session.ById(runningProcess.sessionId),
			);
			if (!session) return null;

			const workspace = await this.workspaceRepo.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) return null;

			return workspace.taskId;
		} catch {
			return null;
		}
	}

	private async collectSessionLogs(sessionId: string): Promise<string[]> {
		const sessions = this.sessionRepo ? [{ id: sessionId }] : [];
		const logs: string[] = [];

		for (const s of sessions) {
			const epPage = await this.executionProcessRepo.list(
				ExecutionProcess.BySessionId(s.id),
				{
					limit: 100,
					sort: { keys: ["createdAt", "id"], order: "asc" },
				},
			);
			for (const ep of epPage.items) {
				const epLogs = await this.executionProcessLogsRepo.getLogs(ep.id);
				if (epLogs?.logs) {
					logs.push(epLogs.logs);
				}
			}
		}

		return logs;
	}

	// ============================================
	// Idle & Completion Handling
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

	private setupCompletionHandler(runningProcess: RunningProcess): void {
		runningProcess.driver.wait(runningProcess.process).then(async (result) => {
			const now = new Date();
			const status: ExecutionProcess.Status = result.killed
				? "killed"
				: result.exitCode === 0
					? "completed"
					: "failed";

			const existing = await this.executionProcessRepo.get(
				ExecutionProcess.ById(runningProcess.id),
			);

			if (existing) {
				await this.executionProcessRepo.upsert({
					...existing,
					status,
					exitCode: result.exitCode,
					completedAt: now,
					updatedAt: now,
				});
			}

			this.runningProcesses.delete(runningProcess.id);
			logStoreManager.close(runningProcess.id);

			const elapsed = now.getTime() - runningProcess.startedAt.getTime();
			if (
				(status === "failed" ||
					(status === "killed" && result.exitCode !== null)) &&
				runningProcess.startOptions?.resumeSessionId &&
				elapsed < 15000
			) {
				this.logger.info(
					"[RESUME_RETRY] Resume failed quickly, retrying without resume",
					{
						processId: runningProcess.id,
						elapsed,
						sessionId: runningProcess.sessionId,
					},
				);
				try {
					const allLogs = await this.collectSessionLogs(
						runningProcess.sessionId,
					);
					const contextSummary = buildContextFromLogs(allLogs);
					const contextPrompt = buildContextRestoredPrompt(
						runningProcess.startOptions.prompt ?? "",
						contextSummary,
					);

					await this.startProtocol({
						...runningProcess.startOptions,
						prompt: contextPrompt,
						resumeSessionId: undefined,
						resumeMessageId: undefined,
						interruptedTools: undefined,
					});
					return;
				} catch (retryError) {
					this.logger.error(
						"[RESUME_RETRY] Retry without resume also failed",
						retryError,
					);
				}
			}

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
