import { spawn } from "bun";
import { fail } from "../../models/common";
import { usecase } from "../runner";

export const initCommit = (path: string) =>
	usecase({
		post: async (ctx) => {
			const { git } = ctx.repos;

			const isRepo = await git.isGitRepo(path);
			if (!isRepo) {
				return fail("INVALID_INPUT", "Path is not a git repository");
			}

			const branches = await git.listBranches(path);
			if (branches.length > 0) {
				return fail("ALREADY_HAS_COMMITS", "Repository already has commits");
			}
			// Create an empty initial commit
			const commitProc = spawn(
				["git", "commit", "--allow-empty", "-m", "initial commit"],
				{ cwd: path, stdout: "pipe", stderr: "pipe" },
			);
			const commitExit = await commitProc.exited;
			if (commitExit !== 0) {
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
			if ((await addProc.exited) !== 0) {
				return { path };
			}

			// Commit staged files if any
			const statusProc = spawn(["git", "diff", "--cached", "--quiet"], {
				cwd: path,
				stdout: "pipe",
				stderr: "pipe",
			});
			if ((await statusProc.exited) !== 0) {
				const snapProc = spawn(["git", "commit", "-m", "Add existing files"], {
					cwd: path,
					stdout: "pipe",
					stderr: "pipe",
				});
				await snapProc.exited;
			}

			return { path };
		},
	});
