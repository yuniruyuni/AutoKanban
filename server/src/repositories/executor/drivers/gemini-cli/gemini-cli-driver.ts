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

interface GeminiProcess extends DriverProcess {
	proc: import("bun").Subprocess<"pipe", "pipe", "pipe">;
}

/**
 * Gemini CLI driver implementation.
 *
 * Uses headless mode (`-p` prompt with `--output-format stream-json`)
 * for non-interactive subprocess execution.
 *
 * Current limitations (can be extended with ACP mode later):
 * - No session resumption (one-shot execution per spawn)
 * - No tool approval flow (auto-approves via --yolo or blocks)
 * - No follow-up messages (each execution is independent)
 */
export class GeminiCliDriver implements ICodingAgentDriver {
	readonly name = "gemini-cli";
	readonly defaultCommand = "gemini";
	readonly displayName = "Gemini CLI";
	readonly installHint = "npm install -g @google/gemini-cli";
	private logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger.child("GeminiCliDriver");
	}

	spawn(options: DriverSpawnOptions): DriverProcess {
		const command = options.command ?? this.defaultCommand;
		const args: string[] = ["-p", "--output-format=stream-json", "--yolo"];

		if (options.model) {
			args.push("--model", options.model);
		}

		const cmd = [command, ...args];

		this.logger.info("Spawning Gemini CLI", {
			cmd: cmd.join(" "),
			cwd: options.workingDir,
		});

		const proc = Bun.spawn({
			cmd,
			cwd: options.workingDir,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				NODE_NO_WARNINGS: "1",
			},
		});

		return {
			proc,
			stdout: proc.stdout,
			stderr: proc.stderr,
		} as GeminiProcess;
	}

	async initialize(
		driverProcess: DriverProcess,
		processId: string,
		callbacks: DriverCallbacks,
	): Promise<void> {
		// Collect stdout logs
		this.collectStream(processId, "stdout", driverProcess.stdout, callbacks);
		// Collect stderr logs
		this.collectStream(processId, "stderr", driverProcess.stderr, callbacks);

		// Gemini CLI in headless mode emits idle when process exits.
		// No protocol handshake needed.
		this.logger.info("Gemini CLI initialized (headless mode)", {
			processId,
		});
	}

	async sendMessage(
		driverProcess: DriverProcess,
		prompt: string,
	): Promise<void> {
		const gp = driverProcess as GeminiProcess;
		// In headless mode, write prompt to stdin and close
		gp.proc.stdin.write(prompt);
		gp.proc.stdin.end();
	}

	async respondToApproval(
		_process: DriverProcess,
		_request: DriverApprovalRequest,
		_approved: boolean,
		_reason?: string,
	): Promise<void> {
		// Gemini CLI in headless/yolo mode does not support approval flow.
		this.logger.warn(
			"respondToApproval called but not supported in headless mode",
		);
	}

	interrupt(driverProcess: DriverProcess): void {
		const gp = driverProcess as GeminiProcess;
		gp.proc.kill(2); // SIGINT
	}

	kill(driverProcess: DriverProcess): void {
		const gp = driverProcess as GeminiProcess;
		gp.proc.kill();
	}

	async gracefulStop(
		driverProcess: DriverProcess,
		options?: { timeoutMs?: number },
	): Promise<{ exitCode: number; killed: boolean; forced: boolean }> {
		const gp = driverProcess as GeminiProcess;
		return performGracefulStop(
			{
				interrupt: () => gp.proc.kill(2),
				kill: () => gp.proc.kill(9),
				exited: gp.proc.exited.then((exitCode) => ({
					exitCode,
					killed: gp.proc.killed,
				})),
			},
			{ timeoutMs: options?.timeoutMs ?? DEFAULT_GRACEFUL_STOP_TIMEOUT_MS },
		);
	}

	async wait(
		driverProcess: DriverProcess,
	): Promise<{ exitCode: number; killed: boolean }> {
		const gp = driverProcess as GeminiProcess;
		const exitCode = await gp.proc.exited;
		return {
			exitCode,
			killed: gp.proc.killed,
		};
	}

	private async collectStream(
		processId: string,
		source: "stdout" | "stderr",
		stream: ReadableStream<Uint8Array>,
		callbacks: DriverCallbacks,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const data = decoder.decode(value, { stream: true });
				callbacks.onLogData(processId, source, data);
			}
		} catch (error) {
			this.logger.error(`Error collecting ${source}:`, error);
		} finally {
			reader.releaseLock();
		}
	}
}
