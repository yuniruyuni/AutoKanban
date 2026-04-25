import type { InfraExecutorDriver } from "../../../../infra/executor";
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

interface CodexProcess extends DriverProcess {
	proc: import("bun").Subprocess<"pipe", "pipe", "pipe">;
	stdin: import("bun").FileSink;
}

export class CodexCliDriver implements ICodingAgentDriver {
	readonly name = "codex-cli";
	readonly displayName = "Codex CLI";
	readonly installHint = "npm install -g @openai/codex";

	constructor(
		private readonly infraDriver: InfraExecutorDriver,
		private readonly logger: ILogger,
	) {}

	get defaultCommand(): string {
		return this.infraDriver.defaultCommand;
	}

	spawn(options: DriverSpawnOptions): DriverProcess {
		const process = this.infraDriver.spawn({
			command: options.command,
			workingDir: options.workingDir,
			model: options.model,
			permissionMode: options.permissionMode,
			resumeToken: options.resumeToken,
			promptFromStdin: true,
		});
		const codexProcess: CodexProcess = {
			proc: process.proc,
			stdin: process.proc.stdin,
			stdout: process.stdout,
			stderr: process.stderr,
		};
		return codexProcess;
	}

	async initialize(
		process: DriverProcess,
		processId: string,
		callbacks: DriverCallbacks,
	): Promise<void> {
		this.collectStream(processId, "stdout", process.stdout, callbacks);
		this.collectStream(processId, "stderr", process.stderr, callbacks);
	}

	async sendMessage(process: DriverProcess, prompt: string): Promise<void> {
		const cp = process as CodexProcess;
		cp.stdin.write(prompt);
		cp.stdin.end();
	}

	async respondToApproval(
		_process: DriverProcess,
		_request: DriverApprovalRequest,
		_approved: boolean,
		_reason?: string,
	): Promise<void> {
		this.logger.warn(
			"Codex CLI approval response is not supported in exec mode",
		);
	}

	interrupt(process: DriverProcess): void {
		(process as CodexProcess).proc.kill(2);
	}

	kill(process: DriverProcess): void {
		(process as CodexProcess).proc.kill();
	}

	async gracefulStop(
		process: DriverProcess,
		options?: { timeoutMs?: number },
	): Promise<{ exitCode: number; killed: boolean; forced: boolean }> {
		const cp = process as CodexProcess;
		return performGracefulStop(
			{
				interrupt: () => cp.proc.kill(2),
				kill: () => cp.proc.kill(9),
				exited: cp.proc.exited.then((exitCode) => ({
					exitCode,
					killed: cp.proc.killed,
				})),
			},
			{ timeoutMs: options?.timeoutMs ?? DEFAULT_GRACEFUL_STOP_TIMEOUT_MS },
		);
	}

	async wait(
		process: DriverProcess,
	): Promise<{ exitCode: number; killed: boolean }> {
		const cp = process as CodexProcess;
		const exitCode = await cp.proc.exited;
		return { exitCode, killed: cp.proc.killed };
	}

	private async collectStream(
		processId: string,
		source: "stdout" | "stderr",
		stream: ReadableStream<Uint8Array>,
		callbacks: DriverCallbacks,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const data = decoder.decode(value, { stream: true });
				buffer += data;
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					const logged = `${line}\n`;
					callbacks.onLogData(processId, source, logged);
					if (source === "stdout") {
						this.detectSessionInfo(line, processId, callbacks);
					}
				}
			}
			if (buffer) {
				callbacks.onLogData(processId, source, buffer);
				if (source === "stdout") {
					this.detectSessionInfo(buffer, processId, callbacks);
				}
			}
		} catch (error) {
			this.logger.error(`Error collecting Codex ${source}:`, error);
		} finally {
			reader.releaseLock();
		}
	}

	private detectSessionInfo(
		line: string,
		processId: string,
		callbacks: DriverCallbacks,
	): void {
		try {
			const json = JSON.parse(line) as Record<string, unknown>;
			const msg =
				(json.msg as Record<string, unknown> | undefined) ??
				(json as Record<string, unknown>);
			const resumeToken = findString(msg, [
				"session_id",
				"thread_id",
				"conversation_id",
			]);
			if (resumeToken) {
				callbacks.onSessionInfo(processId, {
					resumeToken,
					messageToken: null,
				});
			}
		} catch {
			// Ignore non-JSON lines. They are still persisted as raw logs.
		}
	}
}

function findString(
	obj: Record<string, unknown>,
	keys: readonly string[],
): string | null {
	for (const key of keys) {
		const value = obj[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	for (const value of Object.values(obj)) {
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;
		const nested = findString(value as Record<string, unknown>, keys);
		if (nested) return nested;
	}
	return null;
}
