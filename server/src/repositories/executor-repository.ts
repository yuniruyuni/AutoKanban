import { randomUUID } from "node:crypto";
import { Approval } from "../models/approval";
import type { ClaudeControlRequestMessage } from "../models/claude-protocol";
import { CodingAgentTurn } from "../models/coding-agent-turn";
import { ExecutionProcess } from "../models/execution-process";
import { Session } from "../models/session";
import { Task } from "../models/task";
import { Workspace } from "../models/workspace";
import type { ILogger } from "../types/logger";
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
} from "../types/repository";
import {
	AUTO_APPROVE_CALLBACK_ID,
	type ClaudeCodeExecutor,
	type ClaudeCodeOptions,
	type ClaudeCodeProcess,
	type PermissionMode,
} from "./claude-code-executor";
import { LogCollector } from "./log-collector";
import { buildContextFromLogs, buildContextRestoredPrompt } from "../lib/context-builder";
import { logStoreManager } from "./log-store";
import { ProtocolLogCollector } from "./protocol-log-collector";

export interface RunningProcess extends ExecutorProcessInfo {
	process: ClaudeCodeProcess;
	permissionMode?: PermissionMode;
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
 * Repository for managing Claude Code process lifecycle.
 * Handles process spawning, stopping, and message sending.
 * Delegates log collection to LogCollector / ProtocolLogCollector.
 */
export class ExecutorRepository implements IExecutorRepository {
	private runningProcesses = new Map<string, RunningProcess>();
	private completionCallbacks: ProcessCompletionCallback[] = [];
	private idleCallbacks: ProcessIdleCallback[] = [];
	private logCollector: LogCollector;
	private protocolLogCollector: ProtocolLogCollector;
	private logger: ILogger;

	private approvalRepo?: IApprovalRepository;
	private approvalStoreRef?: IApprovalStore;
	private taskRepo?: ITaskRepository;
	private sessionRepo?: ISessionRepository;
	private workspaceRepo?: IWorkspaceRepository;

	constructor(
		private executionProcessRepo: IExecutionProcessRepository,
		private codingAgentTurnRepo: ICodingAgentTurnRepository | undefined,
		private executor: ClaudeCodeExecutor,
		private executionProcessLogsRepo: IExecutionProcessLogsRepository,
		logger: ILogger,
	) {
		this.logger = logger.child("ExecutorRepository");
		this.logCollector = new LogCollector(
			executionProcessLogsRepo,
			logger.child("LogCollector"),
		);
		this.protocolLogCollector = new ProtocolLogCollector(
			executionProcessLogsRepo,
			codingAgentTurnRepo,
			logger.child("ProtocolLogCollector"),
		);

		// Wire up idle detection from protocol log collector
		this.protocolLogCollector.onIdle((processId) => {
			this.notifyIdleCallbacks(processId);
		});

		// Wire up session ID lookup for permission requests
		this.protocolLogCollector.setSessionIdLookup((processId) => {
			return this.runningProcesses.get(processId)?.sessionId;
		});

		// Wire up ExitPlanMode approval request handling
		this.protocolLogCollector.onApprovalRequest((processId, request) => {
			this.handleApprovalRequest(processId, request);
		});

		// Auto-approve non-ExitPlanMode permission requests.
		// After ExitPlanMode approval, tools may go through canUseTool (no hook in plan mode).
		this.protocolLogCollector.onAutoApprove((processId, request) => {
			// can_use_tool uses "input" (not "tool_input") for the tool parameters
			const toolInput = (request.request.input as Record<string, unknown>)
				?? (request.request.tool_input as Record<string, unknown>)
				?? {};
			this.sendPermissionResponse(
				processId, request.request_id, true, request.request.subtype,
				undefined, undefined, toolInput,
			);
		});

		// Handle hookCallback: auto-approve or escalate to canUseTool
		this.protocolLogCollector.onHookCallback((processId, request) => {
			this.handleHookCallback(processId, request);
		});
	}

	/**
	 * Sets the approval-related repos for ExitPlanMode handling.
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

	/**
	 * Registers a callback to be called when any process completes.
	 */
	onProcessComplete(callback: ProcessCompletionCallback): void {
		this.completionCallbacks.push(callback);
	}

	/**
	 * Registers a callback to be called when any process becomes idle (waiting for input).
	 */
	onIdle(callback: ProcessIdleCallback): void {
		this.idleCallbacks.push(callback);
	}

	/**
	 * Starts a new Claude Code process in print mode (legacy one-shot).
	 */
	async start(options: ExecutorStartOptions): Promise<RunningProcess> {
		const id = randomUUID();
		const now = new Date();

		const claudeOptions: ClaudeCodeOptions = {
			workingDir: options.workingDir,
			prompt: options.prompt,
			dangerouslySkipPermissions: options.dangerouslySkipPermissions,
			model: options.model,
		};

		const process = this.executor.spawn(claudeOptions);

		const runningProcess: RunningProcess = {
			id,
			sessionId: options.sessionId,
			runReason: options.runReason,
			process,
			startedAt: now,
		};

		this.runningProcesses.set(id, runningProcess);

		this.executionProcessRepo.upsert({
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

	/**
	 * Starts a new Claude Code process in protocol mode.
	 * Supports session resumption with --resume flag.
	 */
	async startProtocol(
		options: ExecutorStartProtocolOptions,
	): Promise<RunningProcess> {
		const id = randomUUID();
		const now = new Date();

		const permissionMode =
			(options.permissionMode as PermissionMode) ?? "default";

		const process = this.executor.spawnProtocol({
			workingDir: options.workingDir,
			model: options.model,
			resumeSessionId: options.resumeSessionId,
			resumeMessageId: options.resumeMessageId,
			permissionMode,
		});

		const runningProcess: RunningProcess = {
			id,
			sessionId: options.sessionId,
			runReason: options.runReason,
			process,
			startedAt: now,
			permissionMode,
			startOptions: options.resumeSessionId ? options : undefined,
		};

		this.runningProcesses.set(id, runningProcess);

		this.executionProcessRepo.upsert({
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

		// Create CodingAgentTurn if this is a coding agent execution
		if (options.runReason === "codingagent" && this.codingAgentTurnRepo) {
			const turn = CodingAgentTurn.create({
				executionProcessId: id,
				prompt: options.prompt,
			});
			this.codingAgentTurnRepo.upsert(turn);
		}

		this.setupCompletionHandler(runningProcess);

		// Start collecting logs BEFORE sending any messages
		// (read stdout immediately to avoid missing early control messages)
		this.protocolLogCollector.collect(id, process.stdout, process.stderr);

		// Initialize the control protocol with hooks and permission mode
		this.logger.info("[APPROVAL_FLOW] initializing protocol", {
			processId: id,
			permissionMode,
			variant: options.permissionMode,
		});
		await this.executor.initialize(process, permissionMode);

		// If resuming with interrupted tools, send synthetic error results first
		if (options.interruptedTools && options.interruptedTools.length > 0) {
			const toolResults = options.interruptedTools.map((tool) => ({
				toolId: tool.toolId,
				content: `Task "${tool.toolName}" was interrupted due to server restart. Please retry if needed.`,
				isError: true,
			}));
			await this.executor.sendToolResults(process, toolResults);
		}

		// Send the user message (prompt)
		await this.executor.sendUserMessage(process, options.prompt);

		return runningProcess;
	}

	/**
	 * Stops a running process by interrupting current generation (SIGINT).
	 * The process stays alive and becomes idle, preserving conversation context.
	 * Follow-up messages can be sent to the same process.
	 */
	async stop(processId: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		this.executor.interrupt(runningProcess.process);
		// Process stays alive — don't remove from runningProcesses or update DB status.
		// The completion handler will fire only if the process actually exits.
		return true;
	}

	/**
	 * Kills a running process with SIGTERM.
	 * Use this for hard stop when the process needs to be terminated.
	 */
	async kill(processId: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		this.executor.kill(runningProcess.process);

		const now = new Date();
		const existing = this.executionProcessRepo.get(
			ExecutionProcess.ById(processId),
		);

		if (existing) {
			this.executionProcessRepo.upsert({
				...existing,
				status: "killed",
				completedAt: now,
				updatedAt: now,
			});
		}

		this.runningProcesses.delete(processId);
		return true;
	}

	/**
	 * Sends a user message to a running protocol mode process.
	 */
	async sendMessage(processId: string, prompt: string): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		try {
			await this.executor.sendUserMessage(runningProcess.process, prompt);

			// Log the user's message so it appears in the conversation
			const userMessage = {
				type: "user",
				message: {
					role: "user",
					content: prompt,
				},
			};
			const timestamp = new Date().toISOString();
			const logEntry = `[${timestamp}] [stdout] ${JSON.stringify(userMessage)}\n`;
			this.executionProcessLogsRepo.appendLogs(processId, logEntry);

			return true;
		} catch (error) {
			this.logger.error("Failed to send message:", error);
			return false;
		}
	}

	/**
	 * Sends a permission response (approve/deny) to a running process.
	 */
	async sendPermissionResponse(
		processId: string,
		requestId: string,
		approved: boolean,
		requestSubtype?: string,
		reason?: string,
		updatedPermissions?: Array<{
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

		try {
			await this.executor.sendPermissionResponse(
				runningProcess.process,
				requestId,
				approved,
				requestSubtype,
				reason,
				updatedPermissions,
				toolInput,
			);
			return true;
		} catch (error) {
			this.logger.error("Failed to send permission response:", error);
			return false;
		}
	}

	/**
	 * Gets a running process by ID.
	 */
	get(processId: string): RunningProcess | undefined {
		return this.runningProcesses.get(processId);
	}

	/**
	 * Gets all running processes for a session.
	 */
	getBySession(sessionId: string): RunningProcess[] {
		return Array.from(this.runningProcesses.values()).filter(
			(p) => p.sessionId === sessionId,
		);
	}

	/**
	 * Gets the stdout stream for a process.
	 */
	getStdout(processId: string): ReadableStream<Uint8Array> | null {
		const process = this.runningProcesses.get(processId);
		return process?.process.stdout ?? null;
	}

	/**
	 * Gets the stderr stream for a process.
	 */
	getStderr(processId: string): ReadableStream<Uint8Array> | null {
		const process = this.runningProcesses.get(processId);
		return process?.process.stderr ?? null;
	}

	// ============================================
	// Approval Handling (ExitPlanMode)
	// ============================================

	private async handleApprovalRequest(
		processId: string,
		request: ClaudeControlRequestMessage,
	): Promise<void> {
		this.logger.info("[APPROVAL_FLOW] handleApprovalRequest called", {
			processId,
			requestId: request.request_id,
			subtype: request.request.subtype,
			toolName: request.request.tool_name,
		});

		if (!this.approvalRepo || !this.approvalStoreRef) {
			this.logger.error(
				"Approval repos not configured, falling back to auto-approve",
			);
			// Auto-approve if no approval deps configured
			await this.sendPermissionResponse(processId, request.request_id, true, request.request.subtype);
			return;
		}

		const toolCallId =
			(request.request.tool_use_id as string) ?? request.request_id;
		const toolName = (request.request.tool_name as string) ?? "ExitPlanMode";

		// Create approval record
		const approval = Approval.create({
			executionProcessId: processId,
			toolName,
			toolCallId,
		});

		// Transition execution process to awaiting_approval
		const execProcess = this.executionProcessRepo.get(
			ExecutionProcess.ById(processId),
		);
		if (execProcess && execProcess.status === "running") {
			this.executionProcessRepo.upsert({
				...execProcess,
				status: "awaiting_approval",
				updatedAt: new Date(),
			});
		}

		// Transition task to inreview
		const taskId = this.findTaskIdForProcess(processId);
		if (taskId && this.taskRepo) {
			const task = this.taskRepo.get(Task.ById(taskId));
			if (task && task.status === "inprogress") {
				this.taskRepo.upsert({
					...task,
					status: "inreview",
					updatedAt: new Date(),
				});
			}
		}

		this.logger.info("[APPROVAL_FLOW] approval created, waiting for user response", {
			processId,
			approvalId: approval.id,
			toolName: approval.toolName,
		});

		try {
			// Wait for user response (blocks until respond() is called)
			const response = await this.approvalStoreRef.createAndWait(
				approval,
				this.approvalRepo,
			);

			// Send permission response back to Claude.
			const approved = response.status === "approved";
			this.logger.info("[APPROVAL_FLOW] sending canUseTool response", {
				processId,
				requestId: request.request_id,
				approved,
				requestSubtype: request.request.subtype,
				toolName: request.request.tool_name,
			});
			// can_use_tool uses "input" (not "tool_input") for the tool parameters
			const toolInput = (request.request.input as Record<string, unknown>)
				?? (request.request.tool_input as Record<string, unknown>)
				?? {};
			await this.sendPermissionResponse(
				processId,
				request.request_id,
				approved,
				request.request.subtype,
				response.reason ?? undefined,
				undefined,
				toolInput,
			);

			// Update server-side permission mode after approval
			// so subsequent hookCallbacks allow tools instead of denying.
			if (approved) {
				const rp = this.runningProcesses.get(processId);
				if (rp) {
					this.logger.info("[APPROVAL_FLOW] updating permissionMode after approval", {
						processId,
						from: rp.permissionMode,
						to: "bypassPermissions",
					});
					rp.permissionMode = "bypassPermissions";
				}
			}

			// Transition execution process back to running
			const currentProcess = this.executionProcessRepo.get(
				ExecutionProcess.ById(processId),
			);
			if (currentProcess && currentProcess.status === "awaiting_approval") {
				this.executionProcessRepo.upsert({
					...currentProcess,
					status: "running",
					updatedAt: new Date(),
				});
			}

			// Transition task back to inprogress
			if (taskId && this.taskRepo) {
				const task = this.taskRepo.get(Task.ById(taskId));
				if (task && task.status === "inreview") {
					this.taskRepo.upsert({
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

	/**
	 * Find the task ID associated with a process (via session -> workspace -> task).
	 */
	private findTaskIdForProcess(processId: string): string | null {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess || !this.sessionRepo || !this.workspaceRepo)
			return null;

		try {
			const session = this.sessionRepo.get(
				Session.ById(runningProcess.sessionId),
			);
			if (!session) return null;

			const workspace = this.workspaceRepo.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) return null;

			return workspace.taskId;
		} catch {
			return null;
		}
	}

	/**
	 * Collects all execution process logs for a given session.
	 */
	private collectSessionLogs(sessionId: string): string[] {
		const sessions = this.sessionRepo
			? [{ id: sessionId }]
			: [];
		const logs: string[] = [];

		for (const s of sessions) {
			const epPage = this.executionProcessRepo.list(
				ExecutionProcess.BySessionId(s.id),
				{ limit: 100, sort: { keys: ["createdAt", "id"], order: "asc" } },
			);
			for (const ep of epPage.items) {
				const epLogs = this.executionProcessLogsRepo.getLogs(ep.id);
				if (epLogs?.logs) {
					logs.push(epLogs.logs);
				}
			}
		}

		return logs;
	}

	// ============================================
	// Hook Callback Handling
	// ============================================

	/**
	 * Handles hookCallback control requests from Claude Code.
	 * All hook callbacks get "allow" immediately. For ExitPlanMode, the actual
	 * approval gating happens via the simultaneous can_use_tool request
	 * (handleApprovalRequest). Claude Code sends hook_callback and can_use_tool
	 * simultaneously (~2ms apart), so the hook must not block or create its own
	 * approval — that would cause a double-approval problem.
	 */
	private async handleHookCallback(
		processId: string,
		request: ClaudeControlRequestMessage,
	): Promise<void> {
		this.logger.info("[APPROVAL_FLOW] handleHookCallback called", {
			processId,
			requestId: request.request_id,
			callbackId: request.request.callback_id,
		});

		// Always respond "allow" to hook callbacks.
		// - AUTO_APPROVE: auto-approve as before.
		// - tool_approval (ExitPlanMode): let it pass; the gating happens
		//   via the simultaneous can_use_tool → handleApprovalRequest.
		await this.sendHookResponse(processId, request.request_id, "allow");
	}

	/**
	 * Sends a hook callback response to a running process.
	 */
	private async sendHookResponse(
		processId: string,
		requestId: string,
		decision: "allow" | "deny" | "ask",
		reason?: string,
	): Promise<boolean> {
		const runningProcess = this.runningProcesses.get(processId);
		if (!runningProcess) {
			return false;
		}

		try {
			await this.executor.sendHookResponse(
				runningProcess.process,
				requestId,
				decision,
				reason,
			);
			return true;
		} catch (error) {
			this.logger.error("Failed to send hook response:", error);
			return false;
		}
	}

	// ============================================
	// Idle Handling
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

	// ============================================
	// Completion Handling
	// ============================================

	private setupCompletionHandler(runningProcess: RunningProcess): void {
		this.executor.wait(runningProcess.process).then(async (result) => {
			const now = new Date();
			const status: ExecutionProcess.Status = result.killed
				? "killed"
				: result.exitCode === 0
					? "completed"
					: "failed";

			const existing = this.executionProcessRepo.get(
				ExecutionProcess.ById(runningProcess.id),
			);

			if (existing) {
				this.executionProcessRepo.upsert({
					...existing,
					status,
					exitCode: result.exitCode,
					completedAt: now,
					updatedAt: now,
				});
			}

			this.runningProcesses.delete(runningProcess.id);
			logStoreManager.close(runningProcess.id);

			// Retry without resume if a resumed process failed quickly
			const elapsed = now.getTime() - runningProcess.startedAt.getTime();
			if (
				(status === "failed" || (status === "killed" && result.exitCode !== null)) &&
				runningProcess.startOptions?.resumeSessionId &&
				elapsed < 15000
			) {
				this.logger.info("[RESUME_RETRY] Resume failed quickly, retrying without resume", {
					processId: runningProcess.id,
					elapsed,
					sessionId: runningProcess.sessionId,
				});
				try {
					// Build context from previous conversation logs
					const allLogs = this.collectSessionLogs(runningProcess.sessionId);
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
					return; // Don't fire completion callbacks — new process takes over
				} catch (retryError) {
					this.logger.error("[RESUME_RETRY] Retry without resume also failed", retryError);
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
}
