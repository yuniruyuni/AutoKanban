import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

function git(cwd: string, args: string[]): Promise<number> {
	return Bun.spawn(["git", ...args], {
		cwd,
		stdout: "ignore",
		stderr: "ignore",
	}).exited;
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
	const proc = Bun.spawn(["git", ...args], {
		cwd,
		stdout: "pipe",
		stderr: "ignore",
	});
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return text.trim();
}

export async function createTempGitRepo(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "e2e-repo-"));
	tempDirs.push(dir);

	await git(dir, ["init", "-b", "main"]);
	await git(dir, ["config", "user.email", "test@test.com"]);
	await git(dir, ["config", "user.name", "Test"]);
	await git(dir, ["commit", "--allow-empty", "-m", "init"]);

	return dir;
}

/** Create a branch from current HEAD */
export async function createBranch(
	repoPath: string,
	branchName: string,
): Promise<void> {
	await git(repoPath, ["branch", branchName]);
}

/** Checkout a branch */
export async function checkout(
	repoPath: string,
	branchName: string,
): Promise<void> {
	await git(repoPath, ["checkout", branchName]);
}

/** Add a file and commit */
export async function addFileAndCommit(
	repoPath: string,
	filename: string,
	content: string,
	message: string,
): Promise<void> {
	await writeFile(join(repoPath, filename), content);
	await git(repoPath, ["add", filename]);
	await git(repoPath, ["commit", "-m", message]);
}

/** Get current branch name */
export async function getCurrentBranch(repoPath: string): Promise<string> {
	return gitOutput(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

/** List branches */
export async function listBranches(repoPath: string): Promise<string[]> {
	const output = await gitOutput(repoPath, [
		"branch",
		"--format=%(refname:short)",
	]);
	return output
		.split("\n")
		.map((b) => b.trim())
		.filter(Boolean);
}

/** Write auto-kanban.json to a directory */
export async function writeAutoKanbanConfig(
	dir: string,
	config: {
		prepare?: string | null;
		cleanup?: string | null;
		server?: string | null;
	},
): Promise<void> {
	await writeFile(
		join(dir, "auto-kanban.json"),
		JSON.stringify(config, null, 2),
	);
}

export async function cleanupTempRepos(): Promise<void> {
	for (const dir of tempDirs) {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
	tempDirs.length = 0;
}
