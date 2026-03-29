import type { Cursor, Page } from "../../models/common";
import type { ExecutionProcess } from "../../models/execution-process";

export interface IExecutionProcessRepository {
	get(spec: ExecutionProcess.Spec): Promise<ExecutionProcess | null>;
	list(
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Promise<Page<ExecutionProcess>>;
	upsert(process: ExecutionProcess): Promise<void>;
	delete(spec: ExecutionProcess.Spec): Promise<number>;
}
