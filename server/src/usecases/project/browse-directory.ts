// @specre 01KPNTBSGCW3S2Y5XMN9CK1MDG
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fail } from "../../models/common";
import { usecase } from "../runner";

export interface DirectoryEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	isGitRepo: boolean;
	size?: number;
}

async function isGitRepository(dirPath: string): Promise<boolean> {
	try {
		const gitPath = path.join(dirPath, ".git");
		const stat = await fs.stat(gitPath);
		return stat.isDirectory() || stat.isFile(); // .git can be a file for worktrees
	} catch {
		return false;
	}
}

export const browseDirectory = (browsePath?: string, includeFiles?: boolean) =>
	usecase({
		pre: async () => {
			// Default to home directory if no path provided
			const targetPath = browsePath || os.homedir();

			// Resolve and normalize the path
			const resolvedPath = path.resolve(targetPath);

			// Security check: ensure path exists
			try {
				const stat = await fs.stat(resolvedPath);
				if (!stat.isDirectory()) {
					return fail("INVALID_PATH", "Path is not a directory");
				}
			} catch {
				return fail("NOT_FOUND", "Directory not found");
			}

			return {
				targetPath: resolvedPath,
				includeFiles: includeFiles ?? false,
			};
		},

		read: async (ctx, { targetPath, includeFiles }) => {
			try {
				const dirents = await fs.readdir(targetPath, { withFileTypes: true });

				// Filter and transform entries
				const directories: DirectoryEntry[] = [];
				const files: DirectoryEntry[] = [];

				for (const dirent of dirents) {
					// Skip hidden files
					if (dirent.name.startsWith(".")) continue;

					const entryPath = path.join(targetPath, dirent.name);

					if (dirent.isDirectory()) {
						const isGitRepo = await isGitRepository(entryPath);
						directories.push({
							name: dirent.name,
							path: entryPath,
							isDirectory: true,
							isGitRepo,
						});
					} else if (includeFiles && dirent.isFile()) {
						try {
							const stat = await fs.stat(entryPath);
							files.push({
								name: dirent.name,
								path: entryPath,
								isDirectory: false,
								isGitRepo: false,
								size: stat.size,
							});
						} catch {
							// Skip files we can't stat
						}
					}
				}

				// Sort directories and files alphabetically, directories first
				directories.sort((a, b) => a.name.localeCompare(b.name));
				files.sort((a, b) => a.name.localeCompare(b.name));
				const entries = [...directories, ...files];

				// Get parent path
				const parentPath = path.dirname(targetPath);
				const hasParent = parentPath !== targetPath;

				return {
					currentPath: targetPath,
					parentPath: hasParent ? parentPath : null,
					entries,
				};
			} catch (err) {
				ctx.logger.error("Error reading directory:", err);
				return fail("READ_ERROR", "Failed to read directory");
			}
		},

		result: (state) => state,
	});
