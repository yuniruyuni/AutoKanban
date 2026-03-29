import type { Database } from "bun:sqlite";
import { spawn } from "bun";
import type { Cursor, Page } from "../../../models/common";
import type { Tool } from "../../../models/tool";
import type { IToolRepository } from "../repository";
import { del } from "./delete";
import { type SpawnFn, executeCommand } from "./executeCommand";
import { get } from "./get";
import { list } from "./list";
import { listAll } from "./listAll";
import { upsert } from "./upsert";

export type { SpawnFn } from "./executeCommand";

export class ToolRepository implements IToolRepository {
	private spawnFn: SpawnFn;

	constructor(
		private db: Database,
		spawnFn?: SpawnFn,
	) {
		this.spawnFn = spawnFn ?? spawn;
	}

	get(spec: Tool.Spec): Tool | null {
		return get(this.db, spec);
	}

	list(spec: Tool.Spec, cursor: Cursor<Tool.SortKey>): Page<Tool> {
		return list(this.db, spec, cursor);
	}

	listAll(): Tool[] {
		return listAll(this.db);
	}

	upsert(tool: Tool): void {
		upsert(this.db, tool);
	}

	delete(spec: Tool.Spec): number {
		return del(this.db, spec);
	}

	executeCommand(command: string, cwd?: string): void {
		executeCommand(this.spawnFn, command, cwd);
	}
}
