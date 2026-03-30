import { fail } from "../../models/common";
import { usecase } from "../runner";

export interface GetGitInfoInput {
	path: string;
}

export interface GitInfo {
	isGitRepo: boolean;
	hasCommits: boolean;
	path: string;
	currentBranch: string | null;
	remoteUrl: string | null;
	repoName: string | null;
}

export const getGitInfo = (input: GetGitInfoInput) =>
	usecase({
		pre: async () => {
			if (!input.path) {
				return fail("INVALID_INPUT", "Path is required");
			}
			return { path: input.path };
		},

		post: async (ctx, { path }) => {
			const { git } = ctx.repos;

			// Check if it's a git repository
			const isGitRepo = await git.isGitRepo(path);

			if (!isGitRepo) {
				return {
					isGitRepo: false,
					hasCommits: false,
					path,
					currentBranch: null,
					remoteUrl: null,
					repoName: null,
				} as GitInfo;
			}

			// Check if the repository has at least one commit
			const branches = await git.listBranches(path);
			const hasCommits = branches.length > 0;

			// Get current branch
			let currentBranch: string | null = null;
			try {
				currentBranch = await git.getCurrentBranch(path);
			} catch {
				// May fail if HEAD is detached or repo is empty
				currentBranch = null;
			}

			// Get remote URL (using git command)
			let remoteUrl: string | null = null;
			try {
				const { spawn } = await import("bun");
				const proc = spawn(["git", "config", "--get", "remote.origin.url"], {
					cwd: path,
					stdout: "pipe",
					stderr: "pipe",
				});
				const stdout = await new Response(proc.stdout).text();
				if ((await proc.exited) === 0 && stdout.trim()) {
					remoteUrl = stdout.trim();
				}
			} catch {
				remoteUrl = null;
			}

			// Extract repo name from path or remote URL
			let repoName: string | null = null;
			if (remoteUrl) {
				// Extract from URL like git@github.com:user/repo.git or https://github.com/user/repo.git
				const match = remoteUrl.match(/\/([^/]+?)(\.git)?$/);
				if (match) {
					repoName = match[1];
				}
			}
			if (!repoName) {
				// Fall back to directory name
				const { basename } = await import("node:path");
				repoName = basename(path);
			}

			return {
				isGitRepo: true,
				hasCommits,
				path,
				currentBranch,
				remoteUrl,
				repoName,
			} as GitInfo;
		},

		result: (state) => state as GitInfo,
	});
