import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Tool Entity
// ============================================

export interface Tool {
	id: string;
	name: string;
	icon: string;
	iconColor: string;
	command: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Tool Namespace
// ============================================

export namespace Tool {
	// Types
	export type SortKey = "sortOrder" | "createdAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		All: () => ({}),
	});
	export const ById = _specs.ById;
	export const All = _specs.All;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["sortOrder", "id"] as const,
		order: "asc",
	};

	// Factory
	export function create(params: {
		name: string;
		icon: string;
		iconColor?: string;
		command: string;
		sortOrder?: number;
	}): Tool {
		const now = new Date();
		return {
			id: generateId(),
			name: params.name,
			icon: params.icon,
			iconColor: params.iconColor ?? "#6B7280",
			command: params.command,
			sortOrder: params.sortOrder ?? 0,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		tool: Tool,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = tool[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
