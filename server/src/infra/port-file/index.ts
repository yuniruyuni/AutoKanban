import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const PORT_DIR = join(homedir(), ".auto-kanban", "ports");

// Worktree-unique filename: hash of process.cwd() so parallel worktrees running
// `start:dev` don't clobber each other's port. The HTTP server, its MCP config
// router, and the getBaseUrl() fallback all run in the same process (same cwd),
// so they agree on the file. Spawned MCP subprocesses receive AUTO_KANBAN_URL
// via env from getAutoKanbanCommand(), so they don't rely on the file.
const CWD_HASH = createHash("sha1")
	.update(process.cwd())
	.digest("hex")
	.slice(0, 8);
const PORT_FILE = join(PORT_DIR, `${CWD_HASH}.port`);

/**
 * Determine the full command + args to launch `auto-kanban --mcp`.
 *
 * - Compiled binary (`bun build --compile`): process.execPath is the binary itself.
 * - Dev mode (`bun run src/index.ts`): process.execPath is `bun`, process.argv[1] is the script.
 */
export function getAutoKanbanCommand(): {
	command: string;
	args: string[];
	env?: Record<string, string>;
} {
	const scriptArg = process.argv[1];
	const baseUrl = getBaseUrl();

	// Dev mode: argv[1] is a .ts/.js file → need "bun --cwd <server/> <script> --mcp"
	// --cwd ensures Bun finds bunfig.toml (preload plugin) regardless of caller's CWD.
	if (scriptArg && /\.[tj]sx?$/.test(scriptArg)) {
		const absScript = resolve(scriptArg);
		const serverDir = dirname(dirname(absScript));
		return {
			command: process.execPath,
			args: ["--cwd", serverDir, absScript, "--mcp"],
			env: { AUTO_KANBAN_URL: baseUrl },
		};
	}

	// Compiled binary → "<binary> --mcp"
	return {
		command: process.execPath,
		args: ["--mcp"],
		env: { AUTO_KANBAN_URL: baseUrl },
	};
}

export function writePortFile(port: number): void {
	mkdirSync(PORT_DIR, { recursive: true });
	writeFileSync(PORT_FILE, String(port), "utf-8");
}

export function readPortFile(): number | null {
	try {
		if (!existsSync(PORT_FILE)) return null;
		const content = readFileSync(PORT_FILE, "utf-8").trim();
		const port = Number(content);
		return Number.isFinite(port) ? port : null;
	} catch {
		return null;
	}
}

export function removePortFile(): void {
	try {
		if (existsSync(PORT_FILE)) {
			unlinkSync(PORT_FILE);
		}
	} catch {
		// Ignore cleanup errors
	}
}

export function getBaseUrl(): string {
	if (process.env.AUTO_KANBAN_URL) {
		return process.env.AUTO_KANBAN_URL;
	}
	const port = readPortFile();
	if (port) {
		return `http://localhost:${port}`;
	}
	return "http://localhost:3000";
}
