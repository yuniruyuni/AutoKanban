import type { ExecutionProcess } from "../../models/execution-process";
import type { ServiceCtx } from "../common";

export interface ExecutorStartOptions {
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
