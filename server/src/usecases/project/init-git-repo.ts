import { stat } from "node:fs/promises";
import { spawn } from "bun";
import { fail } from "../../models/common";
import { usecase } from "../runner";

export interface InitGitRepoInput {
	path: string;
	defaultBranch?: string;
}

export interface InitGitRepoOutput {
	success: boolean;
	path: string;
	branch: string;
}

export const initGitRepo = (input: InitGitRepoInput) =>
	usecase({
		pre: async () => {
			if (!input.path) {
				return fail("INVALID_INPUT", "Path is required");
			}

			// Verify the path exists and is a directory
			try {
				const stats = await stat(input.path);
				if (!stats.isDirectory()) {
					return fail("INVALID_PATH", "Path is not a directory");
				}
			} catch {
				return fail("NOT_FOUND", "Directory not found");
			}

			return { path: input.path };
		},

		read: async (ctx, { path }) => {
			// Check if it's already a git repository
			const isGitRepo = await ctx.repos.git.isGitRepo(path);
			if (isGitRepo) {
				return fail(
					"ALREADY_GIT_REPO",
					"Directory is already a git repository",
				);
			}
			return { path };
		},

		process: async (_, { path }) => {
			const defaultBranch = input.defaultBranch ?? "main";

			try {
				// Run git init with the specified default branch
				const proc = spawn(["git", "init", "-b", defaultBranch], {
					cwd: path,
					stdout: "pipe",
					stderr: "pipe",
				});

				const exitCode = await proc.exited;
				if (exitCode !== 0) {
					const stderr = await new Response(proc.stderr).text();
					return fail("GIT_INIT_FAILED", `git init failed: ${stderr.trim()}`);
				}

				// Create an empty initial commit so the branch exists
				const commitProc = spawn(
					["git", "commit", "--allow-empty", "-m", "initial commit"],
					{
						cwd: path,
						stdout: "pipe",
						stderr: "pipe",
					},
				);

				const commitExitCode = await commitProc.exited;
				if (commitExitCode !== 0) {
					const stderr = await new Response(commitProc.stderr).text();
					return fail(
						"GIT_COMMIT_FAILED",
						`initial commit failed: ${stderr.trim()}`,
					);
				}

				// Stage all existing files
				const addProc = spawn(["git", "add", "-A"], {
					cwd: path,
					stdout: "pipe",
					stderr: "pipe",
				});

				const addExitCode = await addProc.exited;
				if (addExitCode !== 0) {
					const stderr = await new Response(addProc.stderr).text();
					return fail("GIT_ADD_FAILED", `git add failed: ${stderr.trim()}`);
				}

				// Check if there are staged files to commit
				const statusProc = spawn(["git", "diff", "--cached", "--quiet"], {
					cwd: path,
					stdout: "pipe",
					stderr: "pipe",
				});

				const hasStaged = (await statusProc.exited) !== 0;

				if (hasStaged) {
					const snapshotProc = spawn(
						["git", "commit", "-m", "Add existing files"],
						{
							cwd: path,
							stdout: "pipe",
							stderr: "pipe",
						},
					);

					const snapshotExitCode = await snapshotProc.exited;
					if (snapshotExitCode !== 0) {
						const stderr = await new Response(snapshotProc.stderr).text();
						return fail(
							"GIT_COMMIT_FAILED",
							`snapshot commit failed: ${stderr.trim()}`,
						);
					}
				}

				return {
					success: true,
					path,
					branch: defaultBranch,
				} as InitGitRepoOutput;
			} catch (error) {
				return fail(
					"GIT_INIT_ERROR",
					`Failed to initialize git repository: ${error}`,
				);
			}
		},

		result: (state) => state as InitGitRepoOutput,
	});
