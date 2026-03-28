import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "./common";

// ============================================
// Approval Entity
// ============================================

export interface Approval {
	id: string;
	executionProcessId: string;
	toolName: string;
	toolCallId: string;
	status: Approval.Status;
	reason: string | null;
	createdAt: Date;
	respondedAt: Date | null;
	updatedAt: Date;
}

// ============================================
// Approval Namespace
// ============================================

export namespace Approval {
	// Types
	export type Status = "pending" | "approved" | "denied";
	export type SortKey = "createdAt" | "updatedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		ByExecutionProcessId: (executionProcessId: string) => ({
			type: "ByExecutionProcessId" as const,
			executionProcessId,
		}),
		ByStatus: (status: Status) => ({ type: "ByStatus" as const, status }),
	});
	export const ById = _specs.ById;
	export const ByExecutionProcessId = _specs.ByExecutionProcessId;
	export const ByStatus = _specs.ByStatus;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const statuses: readonly Status[] = [
		"pending",
		"approved",
		"denied",
	] as const;

	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		executionProcessId: string;
		toolName: string;
		toolCallId: string;
	}): Approval {
		const now = new Date();
		return {
			id: generateId(),
			executionProcessId: params.executionProcessId,
			toolName: params.toolName,
			toolCallId: params.toolCallId,
			status: "pending",
			reason: null,
			createdAt: now,
			respondedAt: null,
			updatedAt: now,
		};
	}

	// Respond helper
	export function respond(
		approval: Approval,
		status: "approved" | "denied",
		reason: string | null,
	): Approval {
		const now = new Date();
		return {
			...approval,
			status,
			reason,
			respondedAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		approval: Approval,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = approval[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
