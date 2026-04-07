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
			// SIGKILL the shell wrapper. Orphaned children may keep the pipe
			// write-ends open, so we do not attempt to drain stdout/stderr —
			// partial output on timeout is unreliable anyway.
			process.kill("SIGKILL");
			return {
				exitCode: 124,
				stdout: "",
				stderr: "",
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
