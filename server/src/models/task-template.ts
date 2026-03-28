import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "./common";

// ============================================
// TaskTemplate Entity
// ============================================

export interface TaskTemplate {
	id: string;
	title: string;
	description: string | null;
	condition: TaskTemplate.Condition;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// TaskTemplate Namespace
// ============================================

export namespace TaskTemplate {
	export type Condition = null | "no_dev_server";
	export type SortKey = "sortOrder" | "createdAt" | "id";

	const _specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		All: () => ({ type: "All" as const }),
	});
	export const ById = _specs.ById;
	export const All = _specs.All;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	export const conditions: readonly (Condition | null)[] = [
		null,
		"no_dev_server",
	] as const;

	export const defaultSort: Sort<SortKey> = {
		keys: ["sortOrder", "id"] as const,
		order: "asc",
	};

	export function create(params: {
		title: string;
		description?: string | null;
		condition?: Condition;
		sortOrder?: number;
	}): TaskTemplate {
		const now = new Date();
		return {
			id: generateId(),
			title: params.title,
			description: params.description ?? null,
			condition: params.condition ?? null,
			sortOrder: params.sortOrder ?? 0,
			createdAt: now,
			updatedAt: now,
		};
	}

	export function cursor(
		template: TaskTemplate,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = template[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
