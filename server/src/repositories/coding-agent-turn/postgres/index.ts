import type {
	CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../../../models/coding-agent-turn";
import type { Cursor, Page } from "../../../models/common";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { CodingAgentTurnRepository as ICodingAgentTurnRepository } from "../repository";
import { del } from "./delete";
import { findLatestResumeInfo } from "./findLatestResumeInfo";
import { findLatestResumeInfoByWorkspaceId } from "./findLatestResumeInfoByWorkspaceId";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class CodingAgentTurnRepository implements ICodingAgentTurnRepository {
	async get(
		ctx: DbReadCtx,
		spec: CodingAgentTurn.Spec,
	): Promise<CodingAgentTurn | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Promise<Page<CodingAgentTurn>> {
		return list(ctx.db, spec, cursor);
	}

	async upsert(ctx: DbWriteCtx, turn: CodingAgentTurn): Promise<void> {
		await upsert(ctx.db, turn);
	}

	async delete(ctx: DbWriteCtx, spec: CodingAgentTurn.Spec): Promise<number> {
		return del(ctx.db, spec);
	}

	async findLatestResumeInfo(
		ctx: DbReadCtx,
		sessionId: string,
	): Promise<CodingAgentResumeInfo | null> {
		return findLatestResumeInfo(ctx.db, sessionId);
	}

	async findLatestResumeInfoByWorkspaceId(
		ctx: DbReadCtx,
		workspaceId: string,
	): Promise<CodingAgentResumeInfo | null> {
		return findLatestResumeInfoByWorkspaceId(ctx.db, workspaceId);
	}
}
