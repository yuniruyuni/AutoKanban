import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Session Entity
// ============================================

export interface Session {
	id: string;
	workspaceId: string;
	executor: string | null;
	variant: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Session Namespace
// ============================================

export namespace Session {
	// Types
	export type SortKey = "createdAt" | "updatedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		ByWorkspaceId: (workspaceId: string) => ({ workspaceId }),
	});
	export const ById = _specs.ById;
	export const ByWorkspaceId = _specs.ByWorkspaceId;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		workspaceId: string;
		executor?: string | null;
		variant?: string | null;
	}): Session {
		const now = new Date();
		return {
			id: generateId(),
			workspaceId: params.workspaceId,
			executor: params.executor ?? null,
			variant: params.variant ?? null,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		session: Session,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = session[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
