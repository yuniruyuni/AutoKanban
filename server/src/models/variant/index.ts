import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Variant Entity
// ============================================

export interface Variant {
	id: string;
	executor: string;
	name: string;
	permissionMode: string;
	model: string | null;
	appendPrompt: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Variant Namespace
// ============================================

export namespace Variant {
	// Types
	export type SortKey = "createdAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		ByExecutor: (executor: string) => ({
			type: "ByExecutor" as const,
			executor,
		}),
		ByExecutorAndName: (executor: string, name: string) => ({
			type: "ByExecutorAndName" as const,
			executor,
			name,
		}),
	});
	export const ById = _specs.ById;
	export const ByExecutor = _specs.ByExecutor;
	export const ByExecutorAndName = _specs.ByExecutorAndName;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "asc",
	};

	// Factory
	export function create(params: {
		executor: string;
		name: string;
		permissionMode?: string;
		model?: string | null;
		appendPrompt?: string | null;
	}): Variant {
		const now = new Date();
		return {
			id: generateId(),
			executor: params.executor,
			name: params.name,
			permissionMode: params.permissionMode ?? "bypassPermissions",
			model: params.model ?? null,
			appendPrompt: params.appendPrompt ?? null,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		variant: Variant,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = variant[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
