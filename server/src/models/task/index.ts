// @specre 01KPNX4PA2SQRARM986Y6YDYBV
import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Task Entity
// ============================================

export interface Task {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	status: Task.Status;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Task Namespace
// ============================================

export namespace Task {
	// Types
	export type Status =
		| "todo"
		| "inprogress"
		| "inreview"
		| "done"
		| "cancelled";
	export type SortKey = "createdAt" | "updatedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		ByProject: (projectId: string) => ({ projectId }),
		ByStatus: (status: Status) => ({ status }),
		ByStatuses: (...statuses: Status[]) => ({ statuses }),
	});
	export const ById = _specs.ById;
	export const ByProject = _specs.ByProject;
	export const ByStatus = _specs.ByStatus;
	export const ByStatuses = _specs.ByStatuses;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const statuses: readonly Status[] = [
		"todo",
		"inprogress",
		"inreview",
		"done",
		"cancelled",
	] as const;

	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "desc",
	};

	// State transition validation
	const transitions: Record<Status, Status[]> = {
		todo: ["inprogress", "inreview", "done", "cancelled"],
		inprogress: ["todo", "inreview", "done", "cancelled"],
		inreview: ["todo", "inprogress", "done", "cancelled"],
		done: ["todo", "inprogress", "inreview", "cancelled"],
		cancelled: ["todo", "inprogress", "inreview", "done"],
	};

	// Factory
	export function create(params: {
		projectId: string;
		title: string;
		description?: string | null;
	}): Task {
		const now = new Date();
		return {
			id: generateId(),
			projectId: params.projectId,
			title: params.title,
			description: params.description ?? null,
			status: "todo",
			createdAt: now,
			updatedAt: now,
		};
	}

	// Transition helpers
	export function canTransition(from: Status, to: Status): boolean {
		return transitions[from].includes(to);
	}

	export function getAllowedTransitions(from: Status): Status[] {
		return transitions[from];
	}

	// Approval state transitions
	export function toInReview(task: Task): Task | null {
		if (task.status !== "inprogress") return null;
		return { ...task, status: "inreview" as Status, updatedAt: new Date() };
	}

	export function restoreFromInReview(task: Task): Task | null {
		if (task.status !== "inreview") return null;
		return { ...task, status: "inprogress" as Status, updatedAt: new Date() };
	}

	// Done transition
	export function toDone(task: Task): Task | null {
		if (task.status === "done") return null;
		return { ...task, status: "done" as Status, updatedAt: new Date() };
	}

	// Chat reset detection
	export function needsChatReset(from: Status, to: Status): boolean {
		return to === "todo" && from !== "todo";
	}

	// Cursor
	export function cursor(
		task: Task,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = task[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
