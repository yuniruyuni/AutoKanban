import type { Cursor, Page } from "../../models/common";
import type { ExecutionProcess } from "../../models/execution-process";

export interface IExecutionProcessRepository {
	get(spec: ExecutionProcess.Spec): ExecutionProcess | null;
	list(
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Page<ExecutionProcess>;
	upsert(process: ExecutionProcess): void;
	delete(spec: ExecutionProcess.Spec): number;
}
