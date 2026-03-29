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

	async get(spec: ExecutionProcess.Spec): Promise<ExecutionProcess | null> {
		return get(this.db, spec);
	}

	async list(
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Promise<Page<ExecutionProcess>> {
		return list(this.db, spec, cursor);
	}

	async upsert(process: ExecutionProcess): Promise<void> {
		upsert(this.db, process);
	}

	async delete(spec: ExecutionProcess.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
