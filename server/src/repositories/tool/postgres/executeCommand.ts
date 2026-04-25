import type { spawn } from "bun";

export type SpawnFn = typeof spawn;

export async function executeCommand(
	spawnFn: SpawnFn,
	argv: string[],
	cwd?: string,
): Promise<void> {
	if (argv.length === 0) {
		throw new Error("argv must not be empty");
	}
	spawnFn({
		cmd: argv,
		cwd: cwd || undefined,
		stdout: "inherit",
		stderr: "inherit",
	});
}
