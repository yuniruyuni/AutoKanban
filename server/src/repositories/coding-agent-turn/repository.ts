import type {
	CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../../models/coding-agent-turn";
import type { Cursor, Page } from "../../models/common";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface CodingAgentTurnRepository {
	get(
		ctx: DbReadCtx,
		spec: CodingAgentTurn.Spec,
	): Promise<CodingAgentTurn | null>;
	list(
		ctx: DbReadCtx,
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Promise<Page<CodingAgentTurn>>;
	findLatestResumeInfo(
		ctx: DbReadCtx,
		sessionId: string,
	): Promise<CodingAgentResumeInfo | null>;
	findLatestResumeInfoByWorkspaceId(
		ctx: DbReadCtx,
		workspaceId: string,
	): Promise<CodingAgentResumeInfo | null>;
	upsert(ctx: DbWriteCtx, turn: CodingAgentTurn): Promise<void>;
	delete(ctx: DbWriteCtx, spec: CodingAgentTurn.Spec): Promise<number>;
}
