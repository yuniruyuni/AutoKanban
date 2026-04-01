import type { CodingAgentProcess } from "../../models/coding-agent-process";
import type { Cursor, Page } from "../../models/common";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface CodingAgentProcessRepository {
	get(
		ctx: DbReadCtx,
		spec: CodingAgentProcess.Spec,
	): Promise<CodingAgentProcess | null>;
	list(
		ctx: DbReadCtx,
		spec: CodingAgentProcess.Spec,
		cursor: Cursor<CodingAgentProcess.SortKey>,
	): Promise<Page<CodingAgentProcess>>;
	upsert(ctx: DbWriteCtx, process: CodingAgentProcess): Promise<void>;
	delete(ctx: DbWriteCtx, spec: CodingAgentProcess.Spec): Promise<number>;
}
