import { spawn } from "bun";
import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import type { Tool } from "../../../models/tool";
import type { IToolRepository } from "../repository";
import { del } from "./delete";
import { executeCommand, type SpawnFn } from "./executeCommand";
import { get } from "./get";
import { list } from "./list";
import { listAll } from "./listAll";
import { upsert } from "./upsert";

export type { SpawnFn } from "./executeCommand";

export class ToolRepository implements IToolRepository {
	private spawnFn: SpawnFn;

	constructor(
		private db: PgDatabase,
		spawnFn?: SpawnFn,
	) {
		this.spawnFn = spawnFn ?? spawn;
	}

	async get(spec: Tool.Spec): Promise<Tool | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Tool.Spec,
		cursor: Cursor<Tool.SortKey>,
	): Promise<Page<Tool>> {
		return list(this.db, spec, cursor);
	}

	async listAll(): Promise<Tool[]> {
		return listAll(this.db);
	}

	async upsert(tool: Tool): Promise<void> {
		await upsert(this.db, tool);
	}

	async delete(spec: Tool.Spec): Promise<number> {
		return del(this.db, spec);
	}

	async executeCommand(command: string, cwd?: string): Promise<void> {
		await executeCommand(this.spawnFn, command, cwd);
	}
}
