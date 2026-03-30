import type { Subprocess } from "bun";
import type { ILogger } from "../../../infra/logger/types";
import type { ServiceCtx } from "../../common";
import type { DevServerRepository as DevServerRepositoryDef } from "../repository";

interface RunningDevServer {
	process: Subprocess;
	processId: string;
	pid: number;
}

/**
 * Repository for spawning and managing dev server processes.
 * Pure process I/O only — no DB/repo dependencies.
 */
export class DevServerRepository implements DevServerRepositoryDef {
	private runningProcesses = new Map<string, RunningDevServer>();
	private logger: ILogger;

	constructor(logger: ILogger) {
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
