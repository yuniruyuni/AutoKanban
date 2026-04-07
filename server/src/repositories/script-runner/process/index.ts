import type { ServiceCtx } from "../../common";
import type {
	ScriptRunnerRepository as ScriptRunnerRepositoryDef,
	ScriptRunnerResult,
} from "../repository";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class ScriptRunnerRepository implements ScriptRunnerRepositoryDef {
	async run(
		_ctx: ServiceCtx,
		options: {
			command: string;
			workingDir: string;
			timeoutMs?: number;
		},
	): Promise<ScriptRunnerResult> {
		const { command, workingDir, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

		const process = Bun.spawn(["sh", "-c", command], {
			cwd: workingDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...Bun.env, FORCE_COLOR: "1" },
		});

		const timeoutPromise = new Promise<"timeout">((resolve) => {
			setTimeout(() => resolve("timeout"), timeoutMs);
		});

		const race = await Promise.race([process.exited, timeoutPromise]);

		if (race === "timeout") {
			// SIGKILL ensures the whole process tree is torn down. SIGTERM can
			// leave orphaned children (e.g. `sleep` under `sh -c`) whose open
			// stdout/stderr fds would block the readers below indefinitely.
			process.kill("SIGKILL");
			await process.exited;
			return {
				exitCode: 124,
				stdout: await new Response(process.stdout).text(),
				stderr: await new Response(process.stderr).text(),
			};
		}

		const exitCode = race;
		const [stdout, stderr] = await Promise.all([
			new Response(process.stdout).text(),
			new Response(process.stderr).text(),
		]);

		return { exitCode, stdout, stderr };
	}
}
