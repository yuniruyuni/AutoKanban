import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "./common";

// ============================================
// Task Statistics
// ============================================

export interface TaskStatistics {
	todo: number;
	inProgress: number;
	inReview: number;
	done: number;
	cancelled: number;
}

// ============================================
// Project Entity (Project = 1 Git Repository)
// ============================================

export interface Project {
	id: string;
	name: string;
	description: string | null;
	repoPath: string;
	branch: string;
	setupScript: string | null;
	cleanupScript: string | null;
	devServerScript: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface ProjectWithStats extends Project {
	taskStats: TaskStatistics;
}

// ============================================
// Project Namespace
// ============================================

export namespace Project {
	// Types
	export type SortKey = "createdAt" | "updatedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		ByName: (name: string) => ({ type: "ByName" as const, name }),
		ByRepoPath: (repoPath: string) => ({
			type: "ByRepoPath" as const,
			repoPath,
		}),
		All: () => ({ type: "All" as const }),
	});
	export const ById = _specs.ById;
	export const ByName = _specs.ByName;
	export const ByRepoPath = _specs.ByRepoPath;
	export const All = _specs.All;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		name: string;
		description?: string | null;
		repoPath: string;
		branch?: string;
		setupScript?: string | null;
		cleanupScript?: string | null;
		devServerScript?: string | null;
	}): Project {
		const now = new Date();
		return {
			id: generateId(),
			name: params.name,
			description: params.description ?? null,
			repoPath: params.repoPath,
			branch: params.branch ?? "main",
			setupScript: params.setupScript ?? null,
			cleanupScript: params.cleanupScript ?? null,
			devServerScript: params.devServerScript ?? null,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		project: Project,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = project[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
