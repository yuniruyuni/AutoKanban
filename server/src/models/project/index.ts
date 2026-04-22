// @specre 01KPNX4PA1X0NY458AYEPRTDPM
import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

export type { TaskStatistics } from "./stats";

import type { TaskStatistics } from "./stats";

// ============================================
// Project Entity (Project = 1 Git Repository)
// ============================================

export interface Project {
	id: string;
	name: string;
	description: string | null;
	repoPath: string;
	branch: string;
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
		ById: (id: string) => ({ id }),
		ByName: (name: string) => ({ name }),
		ByRepoPath: (repoPath: string) => ({ repoPath }),
		All: () => ({}),
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
	}): Project {
		const now = new Date();
		return {
			id: generateId(),
			name: params.name,
			description: params.description ?? null,
			repoPath: params.repoPath,
			branch: params.branch ?? "main",
			createdAt: now,
			updatedAt: now,
		};
	}

	// Partial update application
	export interface UpdateFields {
		name?: string;
		description?: string | null;
	}

	export function applyUpdate(
		project: Project,
		fields: UpdateFields,
		now: Date,
	): Project {
		return {
			...project,
			name: fields.name ?? project.name,
			description:
				fields.description !== undefined
					? fields.description
					: project.description,
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
