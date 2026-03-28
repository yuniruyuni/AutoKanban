import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "./common";

// ============================================
// Workspace Entity
// ============================================

export interface Workspace {
	id: string;
	taskId: string;
	containerRef: string;
	branch: string; // Task branch name (e.g., ak-{taskId short}-{attempt})
	worktreePath: string | null; // Path to git worktree
	setupComplete: boolean;
	attempt: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Workspace Namespace
// ============================================

export namespace Workspace {
	// Types
	export type SortKey = "createdAt" | "updatedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		ByTaskId: (taskId: string) => ({ type: "ByTaskId" as const, taskId }),
		ByTaskIdActive: (taskId: string) => ({
			type: "ByTaskIdActive" as const,
			taskId,
		}),
	});
	export const ById = _specs.ById;
	export const ByTaskId = _specs.ByTaskId;
	export const ByTaskIdActive = _specs.ByTaskIdActive;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "desc",
	};

	// Helpers
	export function generateBranchName(taskId: string, attempt: number): string {
		// Use first 8 characters of taskId + attempt for branch name
		return `ak-${taskId.slice(0, 8)}-${attempt}`;
	}

	// Factory
	export function create(params: {
		taskId: string;
		containerRef?: string;
		branch?: string;
		worktreePath?: string | null;
		attempt?: number;
	}): Workspace {
		const now = new Date();
		const id = generateId();
		const attempt = params.attempt ?? 1;
		return {
			id,
			taskId: params.taskId,
			containerRef: params.containerRef ?? "",
			branch: params.branch ?? generateBranchName(params.taskId, attempt),
			worktreePath: params.worktreePath ?? null,
			setupComplete: false,
			attempt,
			archived: false,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		workspace: Workspace,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = workspace[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
