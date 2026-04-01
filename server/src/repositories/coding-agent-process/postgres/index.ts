import type { CodingAgentProcess } from "../../../models/coding-agent-process";
import type { Cursor, Page } from "../../../models/common";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { CodingAgentProcessRepository as ICodingAgentProcessRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class CodingAgentProcessRepository
	implements ICodingAgentProcessRepository
{
	async get(
		ctx: DbReadCtx,
		spec: CodingAgentProcess.Spec,
	): Promise<CodingAgentProcess | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: CodingAgentProcess.Spec,
		cursor: Cursor<CodingAgentProcess.SortKey>,
	): Promise<Page<CodingAgentProcess>> {
		return list(ctx.db, spec, cursor);
	}

	async upsert(ctx: DbWriteCtx, process: CodingAgentProcess): Promise<void> {
		await upsert(ctx.db, process);
	}

	async delete(
		ctx: DbWriteCtx,
		spec: CodingAgentProcess.Spec,
	): Promise<number> {
		return del(ctx.db, spec);
	}
}
