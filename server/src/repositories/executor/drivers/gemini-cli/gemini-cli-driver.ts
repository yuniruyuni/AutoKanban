import type {
	DriverApprovalRequest,
	DriverCallbacks,
	DriverProcess,
	DriverSpawnOptions,
	ICodingAgentDriver,
} from "../../../../types/coding-agent-driver";
import type { Full } from "../../../common";
import type { ILogger } from "../../../../types/logger";
import type {
	CodingAgentTurnRepository,
	ExecutionProcessLogsRepository,
} from "../../../../types/repository";

const GEMINI_CLI_PACKAGE = "@google/gemini-cli@latest";

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
	private logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger.child("GeminiCliDriver");
	}

	spawn(options: DriverSpawnOptions): DriverProcess {
		const args: string[] = [
			GEMINI_CLI_PACKAGE,
			"-p",
			"--output-format=stream-json",
			"--yolo",
		];

		if (options.model) {
			args.push("--model", options.model);
		}

		const cmd = ["npx", "-y", ...args];

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
				NPM_CONFIG_LOGLEVEL: "error",
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
		_callbacks: DriverCallbacks,
		logsRepo: Full<ExecutionProcessLogsRepository>,
		_codingAgentTurnRepo?: Full<CodingAgentTurnRepository>,
	): Promise<void> {
		// Collect stdout logs
		this.collectStream(processId, "stdout", driverProcess.stdout, logsRepo);
		// Collect stderr logs
		this.collectStream(processId, "stderr", driverProcess.stderr, logsRepo);

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
		logsRepo: Full<ExecutionProcessLogsRepository>,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const data = decoder.decode(value, { stream: true });
				const timestamp = new Date().toISOString();
				logsRepo.appendLogs(processId, `[${timestamp}] [${source}] ${data}\n`);
			}
		} catch (error) {
			this.logger.error(`Error collecting ${source}:`, error);
		} finally {
			reader.releaseLock();
		}
	}
}
