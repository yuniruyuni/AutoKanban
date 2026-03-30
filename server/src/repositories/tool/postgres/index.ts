import { spawn } from "bun";
import type { Cursor, Page } from "../../../models/common";
import type { Tool } from "../../../models/tool";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { ToolRepository as IToolRepository } from "../repository";
import { del } from "./delete";
import { executeCommand, type SpawnFn } from "./executeCommand";
import { get } from "./get";
import { list } from "./list";
import { listAll } from "./listAll";
import { upsert } from "./upsert";

export type { SpawnFn } from "./executeCommand";

export class ToolRepository implements IToolRepository {
	private spawnFn: SpawnFn;

	constructor(spawnFn?: SpawnFn) {
		this.spawnFn = spawnFn ?? spawn;
	}

	async get(ctx: DbReadCtx, spec: Tool.Spec): Promise<Tool | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Tool.Spec,
		cursor: Cursor<Tool.SortKey>,
	): Promise<Page<Tool>> {
		return list(ctx.db, spec, cursor);
	}

	async listAll(ctx: DbReadCtx): Promise<Tool[]> {
		return listAll(ctx.db);
	}

	async upsert(ctx: DbWriteCtx, tool: Tool): Promise<void> {
		await upsert(ctx.db, tool);
	}

	async delete(ctx: DbWriteCtx, spec: Tool.Spec): Promise<number> {
		return del(ctx.db, spec);
	}

	async executeCommand(
		_ctx: DbWriteCtx,
		command: string,
		cwd?: string,
	): Promise<void> {
		await executeCommand(this.spawnFn, command, cwd);
	}
}
