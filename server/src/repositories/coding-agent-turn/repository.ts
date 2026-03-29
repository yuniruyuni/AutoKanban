import type {
	CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../../models/coding-agent-turn";
import type { Cursor, Page } from "../../models/common";

export interface ICodingAgentTurnRepository {
	get(spec: CodingAgentTurn.Spec): CodingAgentTurn | null;
	list(
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Page<CodingAgentTurn>;
	upsert(turn: CodingAgentTurn): void;
	delete(spec: CodingAgentTurn.Spec): number;
	updateAgentSessionId(
		executionProcessId: string,
		agentSessionId: string,
	): void;
	updateAgentMessageId(
		executionProcessId: string,
		agentMessageId: string,
	): void;
	updateSummary(executionProcessId: string, summary: string): void;
	findLatestResumeInfo(sessionId: string): CodingAgentResumeInfo | null;
	findLatestResumeInfoByWorkspaceId(
		workspaceId: string,
	): CodingAgentResumeInfo | null;
}
