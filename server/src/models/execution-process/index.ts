import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Execution Process Entity
// ============================================

export interface ExecutionProcess {
	id: string;
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	status: ExecutionProcess.Status;
	exitCode: number | null;
	startedAt: Date;
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Execution Process Logs Entity
// ============================================

export type { ExecutionProcessLogs } from "./logs";

// ============================================
// ExecutionProcess Namespace
// ============================================

export namespace ExecutionProcess {
	// Types
	export type Status =
		| "running"
		| "completed"
		| "failed"
		| "killed"
		| "awaiting_approval";
	export type RunReason =
		| "setupscript"
		| "codingagent"
		| "devserver"
		| "cleanupscript";
	export type SortKey = "createdAt" | "startedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		BySessionId: (sessionId: string) => ({
			type: "BySessionId" as const,
			sessionId,
		}),
		ByStatus: (status: Status) => ({ type: "ByStatus" as const, status }),
		ByRunReason: (runReason: RunReason) => ({
			type: "ByRunReason" as const,
			runReason,
		}),
	});
	export const ById = _specs.ById;
	export const BySessionId = _specs.BySessionId;
	export const ByStatus = _specs.ByStatus;
	export const ByRunReason = _specs.ByRunReason;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const statuses: readonly Status[] = [
		"running",
		"completed",
		"failed",
		"killed",
		"awaiting_approval",
	] as const;

	export const runReasons: readonly RunReason[] = [
		"setupscript",
		"codingagent",
		"devserver",
		"cleanupscript",
	] as const;

	export const defaultSort: Sort<SortKey> = {
		keys: ["startedAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		sessionId: string;
		runReason: RunReason;
	}): ExecutionProcess {
		const now = new Date();
		return {
			id: generateId(),
			sessionId: params.sessionId,
			runReason: params.runReason,
			status: "running",
			exitCode: null,
			startedAt: now,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
		};
	}

	export function complete(
		process: ExecutionProcess,
		status: "completed" | "failed" | "killed",
		exitCode: number | null,
	): ExecutionProcess {
		return {
			...process,
			status,
			exitCode,
			completedAt: new Date(),
			updatedAt: new Date(),
		};
	}

	// Cursor
	export function cursor(
		process: ExecutionProcess,
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
