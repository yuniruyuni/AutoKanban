import type { Subprocess } from "bun";
import type {
	CallbackClient,
	ProcessType,
} from "../../../infra/callback/client";
import type { ILogger } from "../../../infra/logger/types";
import type { ServiceCtx } from "../../common";
import type { LogCollector } from "../../log-collector";
import type { DevServerRepository as DevServerRepositoryDef } from "../repository";

type AsyncScriptProcessType = Extract<
	ProcessType,
	"devserver" | "workspacescript"
>;

interface RunningDevServer {
	process: Subprocess;
	processId: string;
	sessionId: string;
	pid: number;
}

/**
 * Long-running async process runner. Despite the historical name it spawns
 * both the per-session dev server and one-off workspace scripts (prepare /
 * cleanup) — the caller declares which variant via `processType`, which in
 * turn selects the correct persistent logs table (FK-constrained to the
 * matching process table) and the processType value reported back on exit.
 */
export class DevServerRepository implements DevServerRepositoryDef {
	private runningProcesses = new Map<string, RunningDevServer>();
	private logger: ILogger;
	private logCollectors: Record<AsyncScriptProcessType, LogCollector>;
	private callbackClient: CallbackClient;

	constructor(
		logger: ILogger,
		logCollectors: Record<AsyncScriptProcessType, LogCollector>,
		callbackClient: CallbackClient,
	) {
		this.logger = logger.child("DevServerRepository");
		this.logCollectors = logCollectors;
		this.callbackClient = callbackClient;
	}

	start(
		_ctx: ServiceCtx,
		options: {
			processId: string;
			sessionId: string;
			command: string;
			workingDir: string;
			processType: AsyncScriptProcessType;
		},
	): void {
		const { processId, sessionId, command, workingDir, processType } = options;

		this.logger.info(
			`Starting ${processType}: ${command} in ${workingDir} (pid tbd)`,
		);

		const process = Bun.spawn(["sh", "-c", command], {
			cwd: workingDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...Bun.env, FORCE_COLOR: "1" },
		});

		if (!process.pid) {
			this.logger.error(`Failed to start ${processType} process`);
			return;
		}

		const running: RunningDevServer = {
			process,
			processId,
			sessionId,
			pid: process.pid,
		};
		this.runningProcesses.set(processId, running);

		this.logCollectors[processType].collect(
			processId,
			process.stdout,
			process.stderr,
		);

		process.exited.then((exitCode) => {
			this.logger.info(
				`${processType} ${processId} exited with code ${exitCode}`,
			);
			this.runningProcesses.delete(processId);
			const status = exitCode === 0 ? "completed" : "failed";
			this.callbackClient
				.onProcessComplete({
					processId,
					sessionId,
					processType,
					status,
					exitCode: exitCode ?? null,
				})
				.catch((err) => {
					this.logger.error(
						`Failed to notify process completion for ${processId}:`,
						err,
					);
				});
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
