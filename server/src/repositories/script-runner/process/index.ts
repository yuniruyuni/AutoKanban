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
			process.kill("SIGTERM");
			// Wait briefly for graceful shutdown
			await Promise.race([
				process.exited,
				new Promise((r) => setTimeout(r, 5000)),
			]);
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
