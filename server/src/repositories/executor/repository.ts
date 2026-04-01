import type { ProcessType } from "../../infra/callback/client";
import type { ServiceCtx } from "../common";

export interface ExecutorStartOptions {
	id?: string;
	sessionId: string;
	runReason: ProcessType;
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
	runReason: ProcessType;
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
	runReason: ProcessType;
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
	spawnStructured(
		ctx: ServiceCtx,
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
	} | null;
	runStructured(
		ctx: ServiceCtx,
		executorName: string | undefined,
		options: {
			workingDir: string;
			prompt: string;
			schema: Record<string, unknown>;
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
