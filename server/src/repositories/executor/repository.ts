import type { ExecutionProcess } from "../../models/execution-process";

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

export interface IExecutorRepository {
	start(options: ExecutorStartOptions): Promise<ExecutorProcessInfo>;
	startProtocol(
		options: ExecutorStartProtocolOptions,
	): Promise<ExecutorProcessInfo>;
	stop(processId: string): Promise<boolean>;
	sendMessage(processId: string, prompt: string): Promise<boolean>;
	sendPermissionResponse(
		processId: string,
		requestId: string,
		approved: boolean,
		requestSubtype?: string,
		reason?: string,
	): Promise<boolean>;
	startProtocolAndWait(
		options: ExecutorStartProtocolOptions,
	): Promise<{ exitCode: number }>;
	get(processId: string): ExecutorProcessInfo | undefined;
	getBySession(sessionId: string): ExecutorProcessInfo[];
	getStdout(processId: string): ReadableStream<Uint8Array> | null;
	getStderr(processId: string): ReadableStream<Uint8Array> | null;
}
