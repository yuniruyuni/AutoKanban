import type {
	CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../../models/coding-agent-turn";
import type { Cursor, Page } from "../../models/common";

export interface ICodingAgentTurnRepository {
	get(spec: CodingAgentTurn.Spec): Promise<CodingAgentTurn | null>;
	list(
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Promise<Page<CodingAgentTurn>>;
	upsert(turn: CodingAgentTurn): Promise<void>;
	delete(spec: CodingAgentTurn.Spec): Promise<number>;
	updateAgentSessionId(
		executionProcessId: string,
		agentSessionId: string,
	): Promise<void>;
	updateAgentMessageId(
		executionProcessId: string,
		agentMessageId: string,
	): Promise<void>;
	updateSummary(executionProcessId: string, summary: string): Promise<void>;
	findLatestResumeInfo(
		sessionId: string,
	): Promise<CodingAgentResumeInfo | null>;
	findLatestResumeInfoByWorkspaceId(
		workspaceId: string,
	): Promise<CodingAgentResumeInfo | null>;
}
