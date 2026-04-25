import type { ServiceCtx } from "../../common";
import type {
	ScriptRunnerRepository as ScriptRunnerRepositoryDef,
	ScriptRunnerResult,
} from "../repository";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SIGTERM_GRACE_MS = 2000;

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

		// detached: true makes the shell wrapper its own process group leader
		// (pgid == pid), so kill(-pid, sig) reaches the entire descendant tree.
		// Required because user scripts (bun install, dev servers, ...) routinely
		// spawn children that would otherwise survive as orphans and keep ports /
		// pipe write-ends held.
		const process_ = Bun.spawn(["sh", "-c", command], {
			cwd: workingDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...Bun.env, FORCE_COLOR: "1" },
			detached: true,
		});

		const timeoutPromise = new Promise<"timeout">((resolve) => {
			setTimeout(() => resolve("timeout"), timeoutMs);
		});

		const race = await Promise.race([process_.exited, timeoutPromise]);

		if (race === "timeout") {
			killGroup(process_.pid, "SIGTERM");
			const graced = await Promise.race([
				process_.exited,
				new Promise<"still-running">((resolve) =>
					setTimeout(() => resolve("still-running"), SIGTERM_GRACE_MS),
				),
			]);
			if (graced === "still-running") {
				killGroup(process_.pid, "SIGKILL");
				await process_.exited;
			}
			const [stdout, stderr] = await Promise.all([
				new Response(process_.stdout).text(),
				new Response(process_.stderr).text(),
			]);
			return { exitCode: 124, stdout, stderr };
		}

		const exitCode = race;
		const [stdout, stderr] = await Promise.all([
			new Response(process_.stdout).text(),
			new Response(process_.stderr).text(),
		]);

		return { exitCode, stdout, stderr };
	}
}

function killGroup(pid: number, signal: "SIGTERM" | "SIGKILL"): void {
	try {
		process.kill(-pid, signal);
	} catch {
		// ESRCH (group already gone) / EPERM are non-fatal here
	}
}
