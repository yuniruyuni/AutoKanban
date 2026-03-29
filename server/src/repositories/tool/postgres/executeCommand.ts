import type { spawn } from "bun";

export type SpawnFn = typeof spawn;

export async function executeCommand(
	spawnFn: SpawnFn,
	command: string,
	cwd?: string,
): Promise<void> {
	spawnFn({
		cmd: ["sh", "-c", command],
		cwd: cwd || undefined,
		stdout: "inherit",
		stderr: "inherit",
	});
}
