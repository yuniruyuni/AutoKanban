import type { Cursor, Page } from "../../../models/common";
import type { ExecutionProcess } from "../../../models/execution-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { ExecutionProcessRepository as IExecutionProcessRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class ExecutionProcessRepository implements IExecutionProcessRepository {
	async get(
		ctx: DbReadCtx,
		spec: ExecutionProcess.Spec,
	): Promise<ExecutionProcess | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Promise<Page<ExecutionProcess>> {
		return list(ctx.db, spec, cursor);
	}

	async upsert(ctx: DbWriteCtx, process: ExecutionProcess): Promise<void> {
		await upsert(ctx.db, process);
	}

	async delete(ctx: DbWriteCtx, spec: ExecutionProcess.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
