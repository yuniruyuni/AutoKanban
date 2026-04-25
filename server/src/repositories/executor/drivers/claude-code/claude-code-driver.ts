import type { ILogger } from "../../../../infra/logger/types";
import type { ICodingAgentDriver } from "../../orchestrator/coding-agent-driver";
import type { DriverApprovalRequest } from "../../orchestrator/driver-approval-request";
import type { DriverCallbacks } from "../../orchestrator/driver-callbacks";
import type { DriverProcess } from "../../orchestrator/driver-process";
import type { DriverSpawnOptions } from "../../orchestrator/driver-spawn-options";
import {
	DEFAULT_GRACEFUL_STOP_TIMEOUT_MS,
	performGracefulStop,
} from "../../orchestrator/graceful-stop";
import {
	asClaudeCodeProcess,
	ClaudeCodeExecutor,
	type ClaudeCodeProcess,
	TOOL_APPROVAL_CALLBACK_ID,
} from "./claude-code-executor";
import { ProtocolLogCollector } from "./protocol-log-collector";
import type {
	PermissionMode,
	PermissionUpdate,
	PermissionUpdateSetMode,
} from "./protocol-types";

/**
 * Protocol-specific context stored in DriverApprovalRequest.protocolContext.
 * The orchestrator passes this back unchanged to respondToApproval().
 */
interface ClaudeApprovalContext {
	requestId: string;
	requestSubtype: string;
	toolInput: Record<string, unknown>;
}

/**
 * Claude Code driver implementation.
 *
 * Encapsulates ALL Claude-specific protocol handling:
 * - CLI flags and subprocess spawning
 * - JSON control protocol (hooks, permissions, canUseTool)
 * - hookCallback responses ("ask" for ExitPlanMode, "allow" for auto-approve)
 * - Permission response construction (updatedPermissions for mode switching)
 * - Log parsing via ProtocolLogCollector
 *
 * The orchestrator (ExecutorRepository) interacts only via ICodingAgentDriver.
 */
export class ClaudeCodeDriver implements ICodingAgentDriver {
	readonly name = "claude-code";
	readonly defaultCommand = "claude";
	readonly displayName = "Claude Code";
	readonly installHint = "npm install -g @anthropic-ai/claude-code";

	private executor: ClaudeCodeExecutor;
	private logger: ILogger;
	private permissionMode: PermissionMode = "default";

	/** Map processId → native ClaudeCodeProcess (for internal protocol operations) */
	private processes = new Map<string, ClaudeCodeProcess>();

	constructor(logger: ILogger) {
		this.logger = logger.child("ClaudeCodeDriver");
		this.executor = new ClaudeCodeExecutor();
	}

	spawn(options: DriverSpawnOptions): DriverProcess {
		const permissionMode =
			(options.permissionMode as PermissionMode) ?? "default";
		this.permissionMode = permissionMode;

		const nativeProcess = this.executor.spawnProtocol(
			{
				workingDir: options.workingDir,
				model: options.model,
				permissionMode,
				resumeSessionId: options.resumeToken ?? undefined,
				resumeMessageId: options.messageToken ?? undefined,
			},
			options.command ?? this.defaultCommand,
		);

		return nativeProcess as DriverProcess;
	}

	async initialize(
		process: DriverProcess,
		processId: string,
		callbacks: DriverCallbacks,
	): Promise<void> {
		const nativeProcess = asClaudeCodeProcess(process);
		this.processes.set(processId, nativeProcess);

		const collector = new ProtocolLogCollector(this.logger);

		// Wire callbacks

		collector.onIdle((pid) => {
			callbacks.onIdle(pid);
		});

		collector.onLogData((pid, source, data) => {
			callbacks.onLogData(pid, source, data);
		});

		collector.onSessionInfo((pid, info) => {
			callbacks.onSessionInfo(pid, info);
		});

		collector.onSummary((pid, summary) => {
			callbacks.onSummary(pid, summary);
		});

		// ExitPlanMode approval → emit to orchestrator
		collector.onApprovalRequest((pid, request) => {
			const toolInput =
				(request.request.input as Record<string, unknown>) ??
				(request.request.tool_input as Record<string, unknown>) ??
				{};
			const driverRequest: DriverApprovalRequest = {
				toolName: (request.request.tool_name as string) ?? "ExitPlanMode",
				toolCallId:
					(request.request.tool_use_id as string) ?? request.request_id,
				toolInput,
				protocolContext: {
					requestId: request.request_id,
					requestSubtype: request.request.subtype,
					toolInput,
				} satisfies ClaudeApprovalContext,
			};
			callbacks.onApprovalRequest(pid, driverRequest);
		});

		// Auto-approve non-ExitPlanMode permission requests (internal)
		collector.onAutoApprove((pid, request) => {
			const toolInput =
				(request.request.input as Record<string, unknown>) ??
				(request.request.tool_input as Record<string, unknown>) ??
				{};
			const np = this.processes.get(pid);
			if (np) {
				this.executor.sendPermissionResponse(
					np,
					request.request_id,
					true,
					request.request.subtype,
					undefined,
					undefined,
					toolInput,
				);
			}
		});

		// Hook callbacks: "ask" for ExitPlanMode, "allow" for auto-approve
		collector.onHookCallback((pid, request) => {
			const callbackId = request.request.callback_id as string | undefined;
			const np = this.processes.get(pid);
			if (!np) return;

			if (callbackId === TOOL_APPROVAL_CALLBACK_ID) {
				this.executor.sendHookResponse(
					np,
					request.request_id,
					"ask",
					"Forwarding to approval service",
				);
			} else {
				this.executor.sendHookResponse(np, request.request_id, "allow");
			}
		});

		// Start log collection BEFORE sending any messages
		collector.collect(processId, process.stdout, process.stderr);

		// Initialize control protocol (hooks + permission mode)
		await this.executor.initialize(nativeProcess, this.permissionMode);
	}

	async sendMessage(process: DriverProcess, prompt: string): Promise<void> {
		const nativeProcess = asClaudeCodeProcess(process);
		await this.executor.sendUserMessage(nativeProcess, prompt);
	}

	async sendInterruptedToolResults(
		process: DriverProcess,
		tools: Array<{ toolId: string; toolName: string }>,
	): Promise<void> {
		const nativeProcess = asClaudeCodeProcess(process);
		const toolResults = tools.map((tool) => ({
			toolId: tool.toolId,
			content: `Task "${tool.toolName}" was interrupted due to server restart. Please retry if needed.`,
			isError: true,
		}));
		await this.executor.sendToolResults(nativeProcess, toolResults);
	}

	async respondToApproval(
		process: DriverProcess,
		request: DriverApprovalRequest,
		approved: boolean,
		reason?: string,
	): Promise<void> {
		const nativeProcess = asClaudeCodeProcess(process);
		const ctx = request.protocolContext as ClaudeApprovalContext;

		const updatedPermissions: PermissionUpdate[] | undefined = approved
			? [
					{
						type: "setMode",
						mode: "bypassPermissions",
						destination: "session",
					} satisfies PermissionUpdateSetMode,
				]
			: undefined;

		await this.executor.sendPermissionResponse(
			nativeProcess,
			ctx.requestId,
			approved,
			ctx.requestSubtype,
			reason,
			updatedPermissions,
			ctx.toolInput,
		);

		if (approved) {
			this.permissionMode = "bypassPermissions";
		}
	}

	spawnStructured(options: {
		workingDir: string;
		prompt: string;
		schema: Record<string, unknown>;
		model?: string;
		command?: string;
	}): {
		stdout: ReadableStream<Uint8Array>;
		stderr: ReadableStream<Uint8Array>;
		exited: Promise<number>;
	} {
		return this.executor.spawnStructured({
			...options,
			command: options.command ?? this.defaultCommand,
		});
	}

	async runStructured<T>(options: {
		workingDir: string;
		prompt: string;
		schema: Record<string, unknown>;
		model?: string;
		command?: string;
	}): Promise<T | null> {
		return this.executor.runStructured<T>({
			...options,
			command: options.command ?? this.defaultCommand,
		});
	}

	interrupt(process: DriverProcess): void {
		const nativeProcess = asClaudeCodeProcess(process);
		this.executor.interrupt(nativeProcess);
	}

	kill(process: DriverProcess): void {
		const nativeProcess = asClaudeCodeProcess(process);
		this.executor.kill(nativeProcess);
	}

	async gracefulStop(
		process: DriverProcess,
		options?: { timeoutMs?: number },
	): Promise<{ exitCode: number; killed: boolean; forced: boolean }> {
		const nativeProcess = asClaudeCodeProcess(process);
		return performGracefulStop(
			{
				interrupt: () => this.executor.interrupt(nativeProcess),
				kill: () => nativeProcess.proc.kill(9),
				exited: this.executor.wait(nativeProcess),
			},
			{ timeoutMs: options?.timeoutMs ?? DEFAULT_GRACEFUL_STOP_TIMEOUT_MS },
		);
	}

	async wait(
		process: DriverProcess,
	): Promise<{ exitCode: number; killed: boolean }> {
		const nativeProcess = asClaudeCodeProcess(process);
		return this.executor.wait(nativeProcess);
	}
}
