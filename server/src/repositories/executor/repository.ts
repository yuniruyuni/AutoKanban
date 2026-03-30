import type { ExecutionProcess } from "../../models/execution-process";
import type { CodingAgentTurnRepository } from "../coding-agent-turn/repository";
import type { Full, ServiceCtx } from "../common";
import type { ExecutionProcessLogsRepository } from "../execution-process-logs/repository";

export interface ExecutorStartOptions {
	id?: string;
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	workingDir: string;
	prompt: string;
	dangerouslySkipPermissions?: boolean;
	model?: string;
	/** Which driver to use. Defaults to "claude-code". */
	executor?: string;
}

export interface ExecutorStartProtocolOptions {
	id?: string;
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	workingDir: string;
	prompt: string;
	model?: string;
	permissionMode?: string;
	resumeSessionId?: string;
	resumeMessageId?: string;
	interruptedTools?: Array<{ toolId: string; toolName: string }>;
	/** Which driver to use. Defaults to "claude-code". */
	executor?: string;
	/** Logs repository for the driver to collect logs. Passed in by the caller. */
	logsRepo: Full<ExecutionProcessLogsRepository>;
	/** Coding agent turn repository for the driver. Passed in by the caller. */
	codingAgentTurnRepo?: Full<CodingAgentTurnRepository>;
}

export interface ExecutorProcessInfo {
	id: string;
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	startedAt: Date;
}

export interface ExecutorRepository {
	start(
		ctx: ServiceCtx,
		options: ExecutorStartOptions,
	): Promise<ExecutorProcessInfo>;
	startProtocol(
		ctx: ServiceCtx,
		options: ExecutorStartProtocolOptions,
	): Promise<ExecutorProcessInfo>;
	stop(ctx: ServiceCtx, processId: string): Promise<boolean>;
	kill(ctx: ServiceCtx, processId: string): Promise<boolean>;
	sendMessage(
		ctx: ServiceCtx,
		processId: string,
		prompt: string,
	): Promise<boolean>;
	sendPermissionResponse(
		ctx: ServiceCtx,
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
	): Promise<boolean>;
	startProtocolAndWait(
		ctx: ServiceCtx,
		options: ExecutorStartProtocolOptions,
	): Promise<{ exitCode: number }>;
	runStructured(
		ctx: ServiceCtx,
		executorName: string | undefined,
		options: {
			workingDir: string;
			prompt: string;
			schema: Record<string, unknown>;
			resumeSessionId?: string;
			model?: string;
		},
	): Promise<unknown>;
	get(ctx: ServiceCtx, processId: string): ExecutorProcessInfo | undefined;
	getBySession(ctx: ServiceCtx, sessionId: string): ExecutorProcessInfo[];
	getStdout(
		ctx: ServiceCtx,
		processId: string,
	): ReadableStream<Uint8Array> | null;
	getStderr(
		ctx: ServiceCtx,
		processId: string,
	): ReadableStream<Uint8Array> | null;
}
