import type { Subprocess } from "bun";

export interface InfraExecutorProcess {
	proc: Subprocess<"pipe", "pipe", "pipe">;
	stdout: ReadableStream<Uint8Array>;
	stderr: ReadableStream<Uint8Array>;
}

export interface InfraExecutorSpawnOptions {
	command?: string;
	workingDir: string;
	model?: string;
	permissionMode?: string;
	resumeToken?: string;
	promptFromStdin?: boolean;
}

export interface InfraExecutorDriver {
	readonly id: string;
	readonly defaultCommand: string;
	spawn(options: InfraExecutorSpawnOptions): InfraExecutorProcess;
}
