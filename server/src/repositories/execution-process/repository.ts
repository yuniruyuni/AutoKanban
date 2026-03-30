import type { Cursor, Page } from "../../models/common";
import type { ExecutionProcess } from "../../models/execution-process";
import type {
	DbReadCtx,
	DbWriteCtx,
	StripMarkers,
} from "../../types/db-capability";

export interface IExecutionProcessRepositoryDef {
	get(
		ctx: DbReadCtx,
		spec: ExecutionProcess.Spec,
	): Promise<ExecutionProcess | null>;
	list(
		ctx: DbReadCtx,
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Promise<Page<ExecutionProcess>>;
	upsert(ctx: DbWriteCtx, process: ExecutionProcess): Promise<void>;
	delete(ctx: DbWriteCtx, spec: ExecutionProcess.Spec): Promise<number>;
}

export type IExecutionProcessRepository =
	StripMarkers<IExecutionProcessRepositoryDef>;
