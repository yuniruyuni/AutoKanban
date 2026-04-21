// @specre 01KPNX4PAMNEDDBVS0883HYRCG
import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Dev Server Process Entity
// ============================================

export interface DevServerProcess {
	id: string;
	sessionId: string;
	status: DevServerProcess.Status;
	exitCode: number | null;
	startedAt: Date;
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Dev Server Process Logs Entity
// ============================================

export interface DevServerProcessLogs {
	devServerProcessId: string;
	logs: string;
}

// ============================================
// DevServerProcess Namespace
// ============================================

export namespace DevServerProcess {
	// Types
	export type Status = "running" | "completed" | "failed" | "killed";
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
	] as const;

	export const defaultSort: Sort<SortKey> = {
		keys: ["startedAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		sessionId: string;
		id?: string;
	}): DevServerProcess {
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
		process: DevServerProcess,
		status: "completed" | "failed" | "killed",
		exitCode: number | null,
	): DevServerProcess {
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
		process: DevServerProcess,
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
