import type { PgDatabase } from "../../../db/pg-client";
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

export class CodingAgentTurnRepository
	implements ICodingAgentTurnRepository
{
	constructor(private db: PgDatabase) {}

	async get(spec: CodingAgentTurn.Spec): Promise<CodingAgentTurn | null> {
		return get(this.db, spec);
	}

	async list(
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Promise<Page<CodingAgentTurn>> {
		return list(this.db, spec, cursor);
	}

	async upsert(turn: CodingAgentTurn): Promise<void> {
		await upsert(this.db, turn);
	}

	async delete(spec: CodingAgentTurn.Spec): Promise<number> {
		return del(this.db, spec);
	}

	async updateAgentSessionId(
		executionProcessId: string,
		agentSessionId: string,
	): Promise<void> {
		await updateAgentSessionId(this.db, executionProcessId, agentSessionId);
	}

	async updateAgentMessageId(
		executionProcessId: string,
		agentMessageId: string,
	): Promise<void> {
		await updateAgentMessageId(this.db, executionProcessId, agentMessageId);
	}

	async updateSummary(
		executionProcessId: string,
		summary: string,
	): Promise<void> {
		await updateSummary(this.db, executionProcessId, summary);
	}

	async findLatestResumeInfo(
		sessionId: string,
	): Promise<CodingAgentResumeInfo | null> {
		return findLatestResumeInfo(this.db, sessionId);
	}

	async findLatestResumeInfoByWorkspaceId(
		workspaceId: string,
	): Promise<CodingAgentResumeInfo | null> {
		return findLatestResumeInfoByWorkspaceId(this.db, workspaceId);
	}
}
