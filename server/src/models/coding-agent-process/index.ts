// @specre 01KPNX4PA8CV9HVRA6SADJ0WSZ
import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Coding Agent Process Entity
// ============================================

export interface CodingAgentProcess {
	id: string;
	sessionId: string;
	status: CodingAgentProcess.Status;
	exitCode: number | null;
	startedAt: Date;
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Coding Agent Process Logs Entity
// ============================================

export interface CodingAgentProcessLogs {
	codingAgentProcessId: string;
	logs: string;
}

// ============================================
// CodingAgentProcess Namespace
// ============================================

export namespace CodingAgentProcess {
	// Types
	export type Status =
		| "running"
		| "completed"
		| "failed"
		| "killed"
		| "awaiting_approval";
	export type SortKey = "createdAt" | "startedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		BySessionId: (sessionId: string) => ({ sessionId }),
		ByStatus: (status: Status) => ({ status }),
	});
	export const ById = _specs.ById;
	export const BySessionId = _specs.BySessionId;
	export const ByStatus = _specs.ByStatus;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const statuses: readonly Status[] = [
		"running",
		"completed",
		"failed",
		"killed",
		"awaiting_approval",
	] as const;

	export const defaultSort: Sort<SortKey> = {
		keys: ["startedAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		sessionId: string;
		id?: string;
	}): CodingAgentProcess {
		const now = new Date();
		return {
			id: params.id ?? generateId(),
			sessionId: params.sessionId,
			status: "running",
			exitCode: null,
			startedAt: now,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
		};
	}

	export function complete(
		process: CodingAgentProcess,
		status: "completed" | "failed" | "killed",
		exitCode: number | null,
	): CodingAgentProcess {
		return {
			...process,
			status,
			exitCode,
			completedAt: new Date(),
			updatedAt: new Date(),
		};
	}

	// Approval state transitions
	export function toAwaitingApproval(
		process: CodingAgentProcess,
	): CodingAgentProcess | null {
		if (process.status !== "running") return null;
		return { ...process, status: "awaiting_approval", updatedAt: new Date() };
	}

	export function restoreFromApproval(
		process: CodingAgentProcess,
	): CodingAgentProcess | null {
		if (process.status !== "awaiting_approval") return null;
		return { ...process, status: "running", updatedAt: new Date() };
	}

	// Message receive eligibility
	export function canReceiveMessage(
		process: CodingAgentProcess | null,
		isIdle: boolean,
	): boolean {
		if (!process || process.status !== "running") return true;
		return isIdle;
	}

	// Cursor
	export function cursor(
		process: CodingAgentProcess,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = process[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
