import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// WorkspaceRepo Entity (Junction table for Workspace <-> Project)
// ============================================

export interface WorkspaceRepo {
	id: string;
	workspaceId: string;
	projectId: string;
	targetBranch: string;
	prUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// WorkspaceRepo Namespace
// ============================================

export namespace WorkspaceRepo {
	// Types
	export type SortKey = "createdAt" | "updatedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		ByWorkspaceId: (workspaceId: string) => ({ workspaceId }),
		ByProjectId: (projectId: string) => ({ projectId }),
		ByWorkspaceAndProject: (workspaceId: string, projectId: string) => ({
			workspaceId,
			projectId,
		}),
	});
	export const ById = _specs.ById;
	export const ByWorkspaceId = _specs.ByWorkspaceId;
	export const ByProjectId = _specs.ByProjectId;
	export const ByWorkspaceAndProject = _specs.ByWorkspaceAndProject;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "asc",
	};

	// Factory
	export function create(params: {
		workspaceId: string;
		projectId: string;
		targetBranch: string;
		prUrl?: string;
	}): WorkspaceRepo {
		const now = new Date();
		return {
			id: generateId(),
			workspaceId: params.workspaceId,
			projectId: params.projectId,
			targetBranch: params.targetBranch,
			prUrl: params.prUrl ?? null,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Immutable update helpers
	export function withPrUrl(
		repo: WorkspaceRepo,
		prUrl: string,
		now: Date,
	): WorkspaceRepo {
		return { ...repo, prUrl, updatedAt: now };
	}

	// Cursor
	export function cursor(
		workspaceRepo: WorkspaceRepo,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = workspaceRepo[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
