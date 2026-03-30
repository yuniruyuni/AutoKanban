export interface GitDiff {
	filePath: string;
	status: "added" | "modified" | "deleted" | "renamed";
	oldPath?: string; // For renamed files
	additions: number;
	deletions: number;
}
