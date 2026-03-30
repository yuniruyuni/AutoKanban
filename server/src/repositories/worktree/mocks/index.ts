import type { WorktreeRepository } from "../repository";

export function createMockWorktreeRepository(
	overrides: Partial<WorktreeRepository> = {},
): WorktreeRepository {
	return {
		getBaseDir: () => "/tmp/worktrees",
		getWorkspaceDir: () => "/tmp/worktrees/workspace",
		getWorktreePath: () => "/tmp/worktrees/workspace/project",
		createWorktree: async () => "/tmp/worktrees/workspace/project",
		removeWorktree: async () => {},
		removeAllWorktrees: async () => {},
		worktreeExists: async () => false,
		ensureWorktreeExists: async () => "/tmp/worktrees/workspace/project",
		getWorktreeInfo: async () => [],
		pruneWorktrees: async () => {},
		...overrides,
	} as WorktreeRepository;
}
