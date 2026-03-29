import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { ExecutionProcess } from "../../../models/execution-process";
import type { IExecutionProcessRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class ExecutionProcessRepository implements IExecutionProcessRepository {
	constructor(private db: Database) {}

	get(spec: ExecutionProcess.Spec): ExecutionProcess | null {
		return get(this.db, spec);
	}

	list(
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Page<ExecutionProcess> {
		return list(this.db, spec, cursor);
	}

	upsert(process: ExecutionProcess): void {
		upsert(this.db, process);
	}

	delete(spec: ExecutionProcess.Spec): number {
		return del(this.db, spec);
	}
}
