import {
	type Comp,
	defineSpecs,
	generateId,
	type Sort,
	type SpecsOf,
} from "../common";

// ============================================
// Coding Agent Turn Entity
// ============================================

/**
 * CodingAgentTurn tracks Claude Code agent session info for resumption.
 * Each ExecutionProcess with run_reason='codingagent' has one CodingAgentTurn.
 */
export interface CodingAgentTurn {
	id: string;
	executionProcessId: string;
	agentSessionId: string | null; // Claude側のセッションID (--resume用)
	agentMessageId: string | null; // 最後のメッセージID (--resume-session-at用)
	prompt: string | null; // 送信したプロンプト
	summary: string | null; // 最終応答サマリー
	seen: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export type { CodingAgentResumeInfo } from "./resume-info";

// ============================================
// CodingAgentTurn Namespace
// ============================================

export namespace CodingAgentTurn {
	// Types
	export type SortKey = "createdAt" | "id";

	// Specs
	const _specs = defineSpecs({
		ById: (id: string) => ({ id }),
		ByExecutionProcessId: (executionProcessId: string) => ({
			executionProcessId,
		}),
		ByAgentSessionId: (agentSessionId: string) => ({ agentSessionId }),
		HasAgentSessionId: () => ({}),
	});
	export const ById = _specs.ById;
	export const ByExecutionProcessId = _specs.ByExecutionProcessId;
	export const ByAgentSessionId = _specs.ByAgentSessionId;
	export const HasAgentSessionId = _specs.HasAgentSessionId;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Constants
	export const defaultSort: Sort<SortKey> = {
		keys: ["createdAt", "id"] as const,
		order: "desc",
	};

	// Factory
	export function create(params: {
		executionProcessId: string;
		prompt?: string;
	}): CodingAgentTurn {
		const now = new Date();
		return {
			id: generateId(),
			executionProcessId: params.executionProcessId,
			agentSessionId: null,
			agentMessageId: null,
			prompt: params.prompt ?? null,
			summary: null,
			seen: false,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Cursor
	export function cursor(
		turn: CodingAgentTurn,
		keys: readonly SortKey[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const key of keys) {
			const value = turn[key];
			result[key] = value instanceof Date ? value.toISOString() : String(value);
		}
		return result;
	}
}
