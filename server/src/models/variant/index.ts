// @specre 01KPNX4PAGF5SEPD75ZYWRMEDH
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
		ById: (id: string) => ({ id }),
		ByExecutor: (executor: string) => ({ executor }),
		ByExecutorAndName: (executor: string, name: string) => ({
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

	// Partial update application
	export interface UpdateFields {
		name?: string;
		permissionMode?: string;
		model?: string | null;
		appendPrompt?: string | null;
	}

	export function applyUpdate(
		variant: Variant,
		fields: UpdateFields,
		now: Date,
	): Variant {
		return {
			...variant,
			name: fields.name ?? variant.name,
			permissionMode: fields.permissionMode ?? variant.permissionMode,
			model: fields.model !== undefined ? fields.model : variant.model,
			appendPrompt:
				fields.appendPrompt !== undefined
					? fields.appendPrompt
					: variant.appendPrompt,
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
