import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Workspace Script Process Entity
// ============================================

export interface WorkspaceScriptProcess {
	id: string;
	sessionId: string;
	scriptType: WorkspaceScriptProcess.ScriptType;
	status: WorkspaceScriptProcess.Status;
	exitCode: number | null;
	startedAt: Date;
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// Workspace Script Process Logs Entity
// ============================================

export interface WorkspaceScriptProcessLogs {
	workspaceScriptProcessId: string;
	logs: string;
}

// ============================================
// WorkspaceScriptProcess Namespace
// ============================================

export namespace WorkspaceScriptProcess {
	// Types
	export type ScriptType = "prepare" | "cleanup";
	export type Status = "running" | "completed" | "failed" | "killed";
	export type SortKey = "createdAt" | "startedAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		BySessionId: (sessionId: string) => ({ sessionId }),
		ByStatus: (status: Status) => ({ status }),
		ByScriptType: (scriptType: ScriptType) => ({ scriptType }),
	});
	export const ById = _specs.ById;
	export const BySessionId = _specs.BySessionId;
	export const ByStatus = _specs.ByStatus;
	export const ByScriptType = _specs.ByScriptType;

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
		scriptType: ScriptType;
		id?: string;
	}): WorkspaceScriptProcess {
		const now = new Date();
		return {
			id: params.id ?? generateId(),
			sessionId: params.sessionId,
			scriptType: params.scriptType,
			status: "running",
			exitCode: null,
			startedAt: now,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
		};
	}

	export function complete(
		process: WorkspaceScriptProcess,
		status: "completed" | "failed" | "killed",
		exitCode: number | null,
	): WorkspaceScriptProcess {
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
		process: WorkspaceScriptProcess,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			if (key === "createdAt" || key === "startedAt") {
				const value = process[key];
				result[key] =
					value instanceof Date ? value.toISOString() : String(value);
			} else {
				result[key] = String(process[key]);
			}
		}
		return result;
	}
}
