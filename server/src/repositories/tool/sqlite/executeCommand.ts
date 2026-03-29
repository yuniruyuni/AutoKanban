import type { spawn } from "bun";

export type SpawnFn = typeof spawn;

export function executeCommand(
	spawnFn: SpawnFn,
	command: string,
	cwd?: string,
): void {
	spawnFn({
		cmd: ["sh", "-c", command],
		cwd: cwd || undefined,
		stdout: "inherit",
		stderr: "inherit",
	});
}
