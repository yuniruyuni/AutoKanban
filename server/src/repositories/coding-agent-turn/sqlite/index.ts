import type { Database } from "bun:sqlite";
import type {
	CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../../../models/coding-agent-turn";
import type { Cursor, Page } from "../../../models/common";
import type { ICodingAgentTurnRepository } from "../repository";
import { del } from "./delete";
import { findLatestResumeInfo } from "./findLatestResumeInfo";
import { findLatestResumeInfoByWorkspaceId } from "./findLatestResumeInfoByWorkspaceId";
import { get } from "./get";
import { list } from "./list";
import { updateAgentMessageId } from "./updateAgentMessageId";
import { updateAgentSessionId } from "./updateAgentSessionId";
import { updateSummary } from "./updateSummary";
import { upsert } from "./upsert";

export class CodingAgentTurnRepository implements ICodingAgentTurnRepository {
	constructor(private db: Database) {}

	get(spec: CodingAgentTurn.Spec): CodingAgentTurn | null {
		return get(this.db, spec);
	}

	list(
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Page<CodingAgentTurn> {
		return list(this.db, spec, cursor);
	}

	upsert(turn: CodingAgentTurn): void {
		upsert(this.db, turn);
	}

	delete(spec: CodingAgentTurn.Spec): number {
		return del(this.db, spec);
	}

	updateAgentSessionId(
		executionProcessId: string,
		agentSessionId: string,
	): void {
		updateAgentSessionId(this.db, executionProcessId, agentSessionId);
	}

	updateAgentMessageId(
		executionProcessId: string,
		agentMessageId: string,
	): void {
		updateAgentMessageId(this.db, executionProcessId, agentMessageId);
	}

	updateSummary(executionProcessId: string, summary: string): void {
		updateSummary(this.db, executionProcessId, summary);
	}

	findLatestResumeInfo(sessionId: string): CodingAgentResumeInfo | null {
		return findLatestResumeInfo(this.db, sessionId);
	}

	findLatestResumeInfoByWorkspaceId(
		workspaceId: string,
	): CodingAgentResumeInfo | null {
		return findLatestResumeInfoByWorkspaceId(this.db, workspaceId);
	}
}
