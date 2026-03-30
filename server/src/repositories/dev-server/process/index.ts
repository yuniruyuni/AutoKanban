import type { Subprocess } from "bun";
import type { Full, ServiceCtx } from "../../../types/db-capability";
import type { ILogger } from "../../../types/logger";
import type { ExecutionProcessLogsRepository } from "../../../types/repository";
import { LogCollector } from "../../log-collector";
import type { DevServerRepository as DevServerRepositoryDef } from "../repository";

interface RunningDevServer {
	process: Subprocess;
	processId: string;
	pid: number;
}

/**
 * Repository for spawning and managing dev server processes.
 * Uses Bun.spawn directly (not ClaudeCodeExecutor) and
 * LogCollector for log streaming via existing SSE infrastructure.
 */
export class DevServerRepository implements DevServerRepositoryDef {
	private runningProcesses = new Map<string, RunningDevServer>();
	private logCollector: LogCollector;
	private logger: ILogger;

	constructor(
		executionProcessLogsRepo: Full<ExecutionProcessLogsRepository>,
		logger: ILogger,
	) {
		this.logCollector = new LogCollector(
			executionProcessLogsRepo,
			logger.child("DevServerLogCollector"),
		);
		this.logger = logger.child("DevServerRepository");
	}

	start(
		_ctx: ServiceCtx,
		options: {
			processId: string;
			command: string;
			workingDir: string;
		},
	): void {
		const { processId, command, workingDir } = options;

		this.logger.info(`Starting dev server: ${command} in ${workingDir}`);

		const process = Bun.spawn(["sh", "-c", command], {
			cwd: workingDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...Bun.env, FORCE_COLOR: "1" },
		});

		if (!process.pid) {
			this.logger.error("Failed to start dev server process");
			return;
		}

		const running: RunningDevServer = {
			process,
			processId,
			pid: process.pid,
		};
		this.runningProcesses.set(processId, running);

		// Collect stdout/stderr into LogStoreManager for SSE streaming
		this.logCollector.collect(processId, process.stdout, process.stderr);

		// Handle process completion
		process.exited.then((exitCode) => {
			this.logger.info(`Dev server ${processId} exited with code ${exitCode}`);
			this.runningProcesses.delete(processId);
		});
	}

	stop(_ctx: ServiceCtx, processId: string): boolean {
		const running = this.runningProcesses.get(processId);
		if (!running) return false;

		this.logger.info(`Stopping dev server ${processId} (pid: ${running.pid})`);
		running.process.kill("SIGTERM");
		this.runningProcesses.delete(processId);
		return true;
	}

	get(_ctx: ServiceCtx, processId: string): { pid: number } | undefined {
		const running = this.runningProcesses.get(processId);
		if (!running) return undefined;
		return { pid: running.pid };
	}
}
